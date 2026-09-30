"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Download, QrCode, Star } from "lucide-react";
import type { User } from "firebase/auth";
import { dentroDoPrazoEnvio, type Evento } from "@/lib/data/eventos";
import { useMinhaInscricao, diasConfirmadosCount } from "@/lib/data/inscricoes";
import { baixarCertificado } from "@/lib/baixarCertificado";
import { ConfirmarPresencaModal } from "@/components/ConfirmarPresencaModal";

/** Banner do evento marcado como destaque (ou o primeiro evento aberto, na
 * falta de um marcado), com o CTA de inscrição/envio de trabalho. Extraído
 * (2026-09-19) de `aluno/eventos/page.tsx` pra também poder aparecer em
 * `/aluno` — antes só existia lá, o aluno só via isso depois de um clique
 * extra. Mantém a mesma lógica de estado (inscrição, "Inscreva-se" vs
 * "Inscrever trabalho" vs "Pagamento pendente"), só que auto-contida aqui em
 * vez de duplicada em cada página que precisa mostrar o destaque. */
export function DestaqueEventoBanner({
  destaque,
  user,
  jaInscrito,
  onAbrirTrabalho,
  onAbrirInscricao,
}: {
  destaque: Evento;
  user: User | null | undefined;
  jaInscrito: boolean;
  onAbrirTrabalho: (eventoId: string) => void;
  onAbrirInscricao: (eventoId: string) => void;
}) {
  const temTaxa = !!destaque.valorInscricao;
  // Busca sempre (não só quando tem taxa) — é a existência desse registro
  // (mesmo só "interesse") que decide se mostra "Inscreva-se" ou já pula pra
  // "Inscrever trabalho". inscricao undefined também bate `!== "pago"`, por
  // isso o cálculo de pendente já filtra por `!!inscricao` também.
  const { inscricao } = useMinhaInscricao(destaque.id, user?.uid);
  // Evento multi-dia (2026-09-30) — pelo menos 1 dia confirmado já conta
  // como "presença" pra essas badges/gate (ver diasDoEvento em
  // src/lib/certificadoDias.ts); dá no mesmo de antes pra evento de 1 dia só.
  const algumaPresenca = diasConfirmadosCount(inscricao) > 0;
  const pagamentoPendente = temTaxa && !!inscricao && inscricao.status !== "pago";
  const [participando, setParticipando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [baixandoCertificado, setBaixandoCertificado] = useState(false);
  const [erroCertificado, setErroCertificado] = useState<string | null>(null);
  const [confirmandoPresenca, setConfirmandoPresenca] = useState(false);

  async function handleBaixarCertificado() {
    if (!user) return;
    setErroCertificado(null);
    setBaixandoCertificado(true);
    try {
      const resultado = await baixarCertificado(user, {
        papel: "participante",
        eventoId: destaque.id,
      });
      if (!resultado.ok) setErroCertificado(resultado.erro);
    } finally {
      setBaixandoCertificado(false);
    }
  }

  async function participar() {
    if (!user) return;
    setErro(null);
    setParticipando(true);
    try {
      const idToken = await user.getIdToken();
      const resposta = await fetch("/api/asaas/interesse", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId: destaque.id }),
      });
      if (!resposta.ok) throw new Error();
    } catch {
      setErro("Não foi possível registrar. Tente de novo.");
    } finally {
      setParticipando(false);
    }
  }

  return (
    // Sem mx-auto/max-w/mb próprios (2026-09-30, antes só existia 1 destaque
    // por vez aqui) — quem decide largura/centralização/espaçamento agora é
    // a página que usa este card, porque com mais de um destaque eles
    // precisam caber lado a lado numa grade em vez de cada um se centralizar
    // sozinho. Ver /aluno/eventos/page.tsx.
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-fatec-line bg-white shadow-[0_12px_30px_-18px_rgba(14,58,94,0.45)]">
      {/* aspect-[12/5] (2026-09-29, era h-28/h-36/h-44 fixo) — bate com o
          recorte do BannerCropModal (12:5); altura fixa cortava a foto de
          jeito diferente do que o admin via ao recortar, mesmo bug achado
          na home. */}
      <div className="relative aspect-[12/5]">
        {destaque.imagemDestaqueUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={destaque.imagemDestaqueUrl}
            alt={destaque.nome}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-fatec-navy-700 via-fatec-navy-900 to-fatec-sky-600"
          >
            <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-20 left-10 h-64 w-64 rounded-full bg-fatec-orange-500/20 blur-3xl" />
          </div>
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          <Star className="h-3 w-3" strokeWidth={2} />
          Em destaque
        </span>
      </div>

      {/* flex-1 (2026-09-30) — quando 2+ cards ficam lado a lado numa grade
          e esticam pra mesma altura (a imagem acima já é altura fixa via
          aspect-ratio, não estica), é este bloco que absorve a diferença,
          em vez do botão ficar solto no meio do card mais alto. */}
      <div className="flex flex-1 flex-col items-start gap-3 p-5 md:p-6">
        <div>
          <h3 className="text-lg font-bold leading-tight text-fatec-navy-900 md:text-xl">
            {destaque.nome}
          </h3>
          {destaque.periodoSubmissao && (
            <p className="mt-1 text-sm text-fatec-muted">
              Inscrições: {destaque.periodoSubmissao}
            </p>
          )}
          {destaque.periodoEnvioTrabalho && (
            <p className="text-sm font-medium text-fatec-orange-600">
              Submissão: {destaque.periodoEnvioTrabalho}
            </p>
          )}
        </div>

        {!inscricao ? (
          <>
            <button
              type="button"
              onClick={participar}
              disabled={participando}
              className="inline-flex items-center gap-2 rounded-full bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
            >
              {participando ? "Registrando..." : "Inscreva-se"}
            </button>
            {erro && <p className="-mt-2 text-xs text-rose-600">{erro}</p>}
          </>
        ) : jaInscrito && pagamentoPendente ? (
          <button
            type="button"
            onClick={() => onAbrirInscricao(destaque.id)}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
          >
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
            Pagamento pendente — pagar agora
          </button>
        ) : destaque.tipo === "simples" ? (
          // Evento simples (2026-09-22) não tem trabalho nenhum, então não
          // passa pelo branch "jaInscrito && pagamentoPendente" ali em cima
          // (jaInscrito é sobre ter trabalho enviado, nunca acontece aqui) —
          // esse era o bug (2026-09-30, achado: card mostrava "Inscrição
          // confirmada" mesmo sem pagar). Confirmar presença fica junto com
          // o aviso de pagamento pendente, não no lugar dele — são coisas
          // independentes (dá pra escanear o QR no dia do evento mesmo com
          // o pagamento online ainda não confirmado); só "Baixar
          // certificado" espera o pagamento, porque a API já bloqueia isso
          // mesmo (ver /api/certificados).
          <div className="flex flex-wrap items-center gap-2">
            {pagamentoPendente ? (
              <button
                type="button"
                onClick={() => onAbrirInscricao(destaque.id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
              >
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                Pagamento pendente — pagar agora
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                Inscrição confirmada
              </span>
            )}
            {algumaPresenca ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                Presença confirmada
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmandoPresenca(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-fatec-line px-4 py-1.5 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
              >
                <QrCode className="h-3.5 w-3.5" strokeWidth={2} />
                Confirmar presença
              </button>
            )}
            {/* Mesma regra de /api/certificados (papel "participante",
                2026-09-30): liberado + pagamento em dia + presença
                confirmada, os três juntos — senão a API recusa. */}
            {!pagamentoPendente &&
              destaque.certificadosLiberados &&
              algumaPresenca && (
                <button
                  type="button"
                  onClick={handleBaixarCertificado}
                  disabled={baixandoCertificado}
                  className="inline-flex items-center gap-1.5 rounded-full bg-fatec-orange-500 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={2} />
                  {baixandoCertificado ? "Gerando..." : "Baixar certificado"}
                </button>
              )}
            {erroCertificado && <p className="w-full text-xs text-rose-600">{erroCertificado}</p>}
            <ConfirmarPresencaModal
              open={confirmandoPresenca}
              eventoId={destaque.id}
              user={user}
              onClose={() => setConfirmandoPresenca(false)}
              onConfirmado={() => setConfirmandoPresenca(false)}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {jaInscrito ? (
              <Link
                href="/aluno/trabalhos"
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                Inscrição feita — ver trabalho
              </Link>
            ) : dentroDoPrazoEnvio(destaque) ? (
              <button
                type="button"
                onClick={() => onAbrirTrabalho(destaque.id)}
                className="group/btn inline-flex items-center gap-1.5 rounded-full bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600"
              >
                Inscrever trabalho
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5"
                  strokeWidth={2}
                />
              </button>
            ) : (
              // Prazo de submissão encerrado (2026-09-09, pedido do
              // coordenador).
              <span className="inline-flex items-center gap-1.5 rounded-full bg-fatec-navy-50 px-4 py-1.5 text-xs font-semibold text-fatec-muted">
                Submissão encerrada
              </span>
            )}
            {pagamentoPendente && (
              <button
                type="button"
                onClick={() => onAbrirInscricao(destaque.id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
              >
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                Pagamento pendente
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
