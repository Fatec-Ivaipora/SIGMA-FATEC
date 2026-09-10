"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { CheckCircle2, Clock, ExternalLink, Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useMinhaInscricao } from "@/lib/data/inscricoes";

// Depois que a Asaas confirma um Pix/boleto/cartão, ainda leva em média 1-2
// min pra notificação (webhook) chegar até nós — tempo real observado em
// produção (2026-09-10). Enquanto isso, o aluno pode achar que "não
// funcionou" e ficar tentando de novo. Por isso, assim que a cobrança é
// gerada, a gente já avisa o tempo esperado E confere sozinho em segundo
// plano (como Stripe/PagSeguro fazem), sem precisar que ele clique em nada —
// o botão manual continua existindo só pra quem quiser forçar uma conferida.
const INTERVALO_VERIFICACAO_MS = 8000;
const TENTATIVAS_MAXIMAS = 22; // ~3 min de conferida automática

/** Modal de pagamento da inscrição num evento com taxa (2026-08-26, revisado
 * 2026-08-31). Pagamento não bloqueia mais trabalho/convites — a diretoria
 * não quis essa trava (ver src/app/aluno/eventos/page.tsx) — então esse modal
 * cuida só do pagamento em si; o aluno pode abrir/fechar isso a qualquer
 * momento, antes ou depois de já ter enviado o trabalho. */
export function InscricaoEventoModal({
  open,
  eventoId,
  eventoNome,
  valor,
  temCpf,
  user,
  onClose,
}: {
  open: boolean;
  eventoId: string;
  eventoNome: string;
  valor: number;
  temCpf: boolean;
  user: User | null | undefined;
  onClose: () => void;
}) {
  const { inscricao } = useMinhaInscricao(eventoId, user?.uid);
  const pago = inscricao?.status === "pago";

  const [cpf, setCpf] = useState("");
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aindaNaoCaiu, setAindaNaoCaiu] = useState(false);
  const tentativasAutomaticas = useRef(0);

  function fechar() {
    setCpf("");
    setInvoiceUrl(null);
    setErro(null);
    setAindaNaoCaiu(false);
    tentativasAutomaticas.current = 0;
    onClose();
  }

  async function gerarCobranca() {
    if (!user) return;
    setErro(null);
    setGerando(true);
    try {
      const idToken = await user.getIdToken();
      const resposta = await fetch("/api/asaas/cobranca", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId, cpf: cpf.replace(/\D/g, "") }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.erro ?? "Não foi possível gerar a cobrança.");
      setInvoiceUrl(corpo.invoiceUrl);
      window.open(corpo.invoiceUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  async function verificarPagamento(silenciosa = false) {
    if (!user) return;
    if (!silenciosa) {
      setErro(null);
      setVerificando(true);
    }
    try {
      const idToken = await user.getIdToken();
      const resposta = await fetch(
        `/api/asaas/status?eventoId=${encodeURIComponent(eventoId)}`,
        { headers: { Authorization: `Bearer ${idToken}` } },
      );
      const corpo = await resposta.json();
      if (corpo.status === "pago") {
        setAindaNaoCaiu(false);
      } else if (!silenciosa) {
        // Não é erro de verdade — é só "ainda não chegou", o normal
        // enquanto a confirmação (Pix/boleto/cartão) está em trânsito.
        setAindaNaoCaiu(true);
      }
    } catch {
      if (!silenciosa) setErro("Não foi possível verificar o pagamento agora.");
    } finally {
      if (!silenciosa) setVerificando(false);
    }
  }

  // Conferida automática em segundo plano (2026-09-10) — o mesmo endpoint
  // que o botão manual chama, só que sem aparecer nada de "erro" na tela;
  // assim que confirmar, useMinhaInscricao (onSnapshot) já atualiza `pago`
  // sozinho e a tela muda pra "confirmado" sem o aluno precisar fazer nada.
  useEffect(() => {
    if (!invoiceUrl || pago) return;
    tentativasAutomaticas.current = 0;
    const id = setInterval(() => {
      tentativasAutomaticas.current += 1;
      if (tentativasAutomaticas.current > TENTATIVAS_MAXIMAS) {
        clearInterval(id);
        return;
      }
      verificarPagamento(true);
    }, INTERVALO_VERIFICACAO_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceUrl, pago]);

  const cpfValido = cpf.replace(/\D/g, "").length === 11;
  const podeGerar = temCpf || cpfValido;

  return (
    <Modal open={open} onClose={fechar} title={`Inscrição — ${eventoNome}`}>
      <div className="flex flex-col gap-6">
        {!pago ? (
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl bg-fatec-navy-50 px-5 py-4">
              <p className="text-sm text-fatec-muted">Valor da inscrição</p>
              <p className="text-3xl font-bold text-fatec-navy-900">
                R$ {valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>

            {!temCpf && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-fatec-navy-900">
                  CPF <span className="text-fatec-orange-600">*</span>
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="Só números, 11 dígitos"
                  maxLength={14}
                  className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
                />
                <span className="text-xs text-fatec-muted">
                  Exigido pelo Asaas para emitir a cobrança (Pix, boleto ou cartão).
                </span>
              </label>
            )}

            {erro && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
            )}

            {!invoiceUrl ? (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={gerarCobranca}
                  disabled={!podeGerar || gerando}
                  className="flex w-fit items-center gap-2 rounded-xl bg-fatec-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
                >
                  {gerando && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
                  {gerando ? "Gerando cobrança..." : "Pagar agora"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <a
                  href={invoiceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-fit items-center gap-2 rounded-xl bg-fatec-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600"
                >
                  <ExternalLink className="h-4 w-4" strokeWidth={2} />
                  Abrir página de pagamento
                </a>

                <div className="flex items-start gap-2 rounded-xl bg-fatec-sky-50 px-4 py-3 text-sm text-fatec-navy-800">
                  <Clock className="mt-0.5 h-4 w-4 flex-none" strokeWidth={2} />
                  <p>
                    Depois de pagar (Pix, boleto ou cartão), a confirmação
                    pode levar de 1 a 2 minutos. Assim que cair, essa tela
                    atualiza sozinha — não precisa fechar nem tentar de novo.
                  </p>
                </div>

                {aindaNaoCaiu && (
                  <p className="flex items-center gap-2 rounded-xl bg-fatec-orange-50 px-4 py-3 text-sm text-fatec-orange-700">
                    <Loader2 className="h-4 w-4 flex-none animate-spin" strokeWidth={2} />
                    Ainda não identificamos o pagamento. Se você já pagou,
                    aguarde mais um instante — costuma confirmar sozinho.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => verificarPagamento()}
                  disabled={verificando}
                  className="flex w-fit items-center gap-2 rounded-xl border border-fatec-line px-6 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:text-fatec-muted"
                >
                  {verificando ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                  )}
                  {verificando ? "Verificando..." : "Verificar pagamento"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-emerald-50 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
              <CheckCircle2 className="h-6 w-6" strokeWidth={2} />
            </span>
            <p className="font-semibold text-fatec-navy-900">Pagamento confirmado</p>
            <p className="text-sm text-fatec-muted">
              Sua inscrição nesse evento está paga. Pode fechar essa janela —
              o envio do trabalho (se ainda não fez) fica na tela de Eventos.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
