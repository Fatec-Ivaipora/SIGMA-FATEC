"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { CheckCircle2, ExternalLink, FlaskConical, Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useMinhaInscricao } from "@/lib/data/inscricoes";

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
  permiteSimulacao,
  user,
  onClose,
}: {
  open: boolean;
  eventoId: string;
  eventoNome: string;
  valor: number;
  temCpf: boolean;
  permiteSimulacao?: boolean;
  user: User | null | undefined;
  onClose: () => void;
}) {
  const { inscricao } = useMinhaInscricao(eventoId, user?.uid);
  const pago = inscricao?.status === "pago";

  const [cpf, setCpf] = useState("");
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [simulando, setSimulando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    setCpf("");
    setInvoiceUrl(null);
    setErro(null);
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

  async function verificarPagamento() {
    if (!user) return;
    setErro(null);
    setVerificando(true);
    try {
      const idToken = await user.getIdToken();
      const resposta = await fetch(
        `/api/asaas/status?eventoId=${encodeURIComponent(eventoId)}`,
        { headers: { Authorization: `Bearer ${idToken}` } },
      );
      const corpo = await resposta.json();
      if (corpo.status !== "pago") {
        setErro(
          "Ainda não identificamos o pagamento. Se você acabou de pagar, aguarde alguns instantes e tente de novo.",
        );
      }
    } catch {
      setErro("Não foi possível verificar o pagamento agora.");
    } finally {
      setVerificando(false);
    }
  }

  async function simularPagamento() {
    if (!user) return;
    setErro(null);
    setSimulando(true);
    try {
      const idToken = await user.getIdToken();
      const resposta = await fetch("/api/asaas/simular", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.erro ?? "Não foi possível simular o pagamento.");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSimulando(false);
    }
  }

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

                {permiteSimulacao && (
                  <div className="flex flex-col gap-2 rounded-xl border border-dashed border-fatec-line px-4 py-3">
                    <p className="text-xs text-fatec-muted">
                      Evento de demonstração — use isto pra testar o resto do
                      fluxo sem gerar cobrança nenhuma.
                    </p>
                    <button
                      type="button"
                      onClick={simularPagamento}
                      disabled={simulando}
                      className="flex w-fit items-center gap-2 rounded-lg border border-fatec-line px-4 py-2 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:text-fatec-muted"
                    >
                      {simulando ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                      ) : (
                        <FlaskConical className="h-3.5 w-3.5" strokeWidth={2} />
                      )}
                      {simulando ? "Simulando..." : "Simular pagamento (modo de teste)"}
                    </button>
                  </div>
                )}
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
                <button
                  type="button"
                  onClick={verificarPagamento}
                  disabled={verificando}
                  className="flex w-fit items-center gap-2 rounded-xl border border-fatec-line px-6 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:text-fatec-muted"
                >
                  {verificando ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                  )}
                  {verificando ? "Verificando..." : "Já paguei, verificar"}
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
