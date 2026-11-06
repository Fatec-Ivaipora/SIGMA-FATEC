"use client";

// ⚠ EXCEÇÃO TEMPORÁRIA — ver comentário em
// src/app/api/revisao-externa/convidar/route.ts. Remover junto com o
// resto da feature depois que os 46 legados da X MAC forem reavaliados.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { renderResumoFormatado } from "@/lib/textoFormatado";

type TrabalhoConvite = {
  id: string;
  titulo: string;
  resumo: string;
  palavrasChave: string;
  areaTematica: string;
  avaliado: boolean;
};

const CRITERIOS = [
  {
    key: "suficiencia",
    label: "Suficiência",
    descricao:
      "O resumo traz informação suficiente (contexto, objetivo, método, resultados) pra dar pra entender do que se trata o trabalho.",
  },
  {
    key: "coerencia",
    label: "Coerência",
    descricao:
      "As partes do resumo se conectam sem contradição — o que foi proposto bate com o que foi apresentado como resultado.",
  },
  {
    key: "estruturaTexto",
    label: "Estrutura do texto",
    descricao:
      "Segue a estrutura esperada: introdução, objetivos, materiais e métodos, resultados, considerações finais.",
  },
  {
    key: "clarezaPrecisao",
    label: "Clareza e precisão",
    descricao: "Escrita clara e direta, sem termos vagos, ambíguos ou informação confusa.",
  },
  {
    key: "aplicabilidadeRelevancia",
    label: "Aplicabilidade e relevância",
    descricao:
      "O trabalho tem relevância científica, acadêmica ou social, com contribuição ou aplicação prática reconhecível.",
  },
] as const;

const NOTAS = [1, 2, 3, 4, 5];

export default function ReavaliacaoExternaPage() {
  const { token } = useParams<{ token: string }>();
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [eventoNome, setEventoNome] = useState("");
  const [trabalhos, setTrabalhos] = useState<TrabalhoConvite[]>([]);
  const [nome, setNome] = useState("");
  const [nomeConfirmado, setNomeConfirmado] = useState(false);
  // Lista primeiro, avaliação dentro de um modal — mesmo padrão da tela do
  // avaliador interno (2026-11-06, pedido explícito do usuário — "ele
  // entra e vê ali a lista... clica em avaliar... tudo igual a tela que já
  // usamos com os avaliadores"). Nada de abrir os 4-5 trabalhos inteiros
  // (resumo + critérios) todos de uma vez na página.
  const [avaliando, setAvaliando] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/revisao-externa/${token}`)
      .then(async (res) => {
        const dados = await res.json();
        if (!res.ok) {
          setErroCarga(dados?.erro ?? "Não foi possível carregar esse link.");
          return;
        }
        setEventoNome(dados.eventoNome ?? "");
        setTrabalhos(dados.trabalhos ?? []);
        if (dados.nome) {
          setNome(dados.nome);
          setNomeConfirmado(true);
        }
      })
      .catch(() => setErroCarga("Não foi possível carregar esse link."))
      .finally(() => setCarregando(false));
  }, [token]);

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-fatec-navy-50">
        <Loader2 className="h-8 w-8 animate-spin text-fatec-navy-700" strokeWidth={1.75} />
      </main>
    );
  }

  if (erroCarga) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-fatec-navy-50 px-6">
        <div className="max-w-md rounded-2xl border border-fatec-line bg-white p-8 text-center">
          <p className="text-sm font-semibold text-rose-600">{erroCarga}</p>
          <p className="mt-2 text-sm text-fatec-muted">
            Se você acha que isso é um engano, entre em contato com quem te convidou.
          </p>
        </div>
      </main>
    );
  }

  if (!nomeConfirmado) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-fatec-navy-50 px-6">
        <div className="w-full max-w-md rounded-2xl border border-fatec-line bg-white p-8">
          <p className="text-xs font-bold uppercase tracking-[0.02em] text-fatec-sky-600">
            SIGMA · {eventoNome}
          </p>
          <h1 className="mt-1 text-xl font-bold text-fatec-navy-900">Avaliação externa</h1>
          <p className="mt-2 text-sm text-fatec-muted">
            Antes de começar, confirme seu nome completo — ele fica registrado como quem deu a
            nota de cada trabalho.
          </p>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome completo"
            className="mt-4 w-full rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink outline-none focus:border-fatec-sky-600"
          />
          <button
            type="button"
            disabled={!nome.trim()}
            onClick={() => setNomeConfirmado(true)}
            className="mt-4 w-full rounded-xl bg-fatec-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted"
          >
            Continuar
          </button>
        </div>
      </main>
    );
  }

  const trabalhoAvaliando = trabalhos.find((t) => t.id === avaliando);

  return (
    <main className="min-h-screen bg-fatec-navy-50 px-4 py-10 md:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <div className="rounded-2xl border border-fatec-line bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-[0.02em] text-fatec-sky-600">
            SIGMA · {eventoNome}
          </p>
          <h1 className="mt-1 text-xl font-bold text-fatec-navy-900">Avaliação externa</h1>
          <p className="mt-2 text-sm text-fatec-muted">
            Olá, {nome.trim().split(/\s+/)[0]}. Você tem{" "}
            {trabalhos.filter((t) => !t.avaliado).length} trabalho(s) pra avaliar. Clique em
            &ldquo;Avaliar&rdquo; pra ver o resumo e dar a nota de cada critério, de 1 (mais
            fraco) a 5 (mais forte) — a nota final é a soma dos 5.
          </p>
          {trabalhos.every((t) => t.avaliado) && (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 flex-none" strokeWidth={1.75} />
              Você já avaliou tudo que foi enviado pra você. Obrigado pela ajuda!
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-fatec-line bg-white">
          {trabalhos.map((t, i) => (
            <div
              key={t.id}
              className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${
                i > 0 ? "border-t border-fatec-line" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="font-medium leading-snug text-fatec-navy-900">{t.titulo}</p>
                <p className="text-sm text-fatec-muted">{t.areaTematica}</p>
              </div>
              {t.avaliado ? (
                <span className="flex flex-none items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 flex-none" strokeWidth={2} />
                  Avaliado
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAvaliando(t.id)}
                  className="flex-none rounded-lg bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-fatec-orange-600"
                >
                  Avaliar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <Modal open={!!trabalhoAvaliando} onClose={() => setAvaliando(null)} title="Avaliar trabalho" size="lg">
        {trabalhoAvaliando && (
          <FormularioAvaliacao
            token={token}
            trabalho={trabalhoAvaliando}
            nome={nome}
            onEnviado={() => {
              setTrabalhos((prev) =>
                prev.map((x) => (x.id === trabalhoAvaliando.id ? { ...x, avaliado: true } : x)),
              );
              setAvaliando(null);
            }}
          />
        )}
      </Modal>
    </main>
  );
}

function FormularioAvaliacao({
  token,
  trabalho,
  nome,
  onEnviado,
}: {
  token: string;
  trabalho: TrabalhoConvite;
  nome: string;
  onEnviado: () => void;
}) {
  const [notas, setNotas] = useState<Record<string, number>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const somaNotas = CRITERIOS.reduce((acc, c) => acc + (notas[c.key] ?? 0), 0);
  const completo = CRITERIOS.every((c) => notas[c.key]);

  async function enviar() {
    if (!completo) return;
    setEnviando(true);
    setErro(null);
    const res = await fetch(`/api/revisao-externa/${token}/avaliar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trabalhoId: trabalho.id, notas, nome }),
    });
    const dados = await res.json().catch(() => null);
    if (!res.ok) {
      setErro(dados?.erro ?? "Não foi possível enviar a nota.");
      setEnviando(false);
      return;
    }
    onEnviado();
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-lg font-bold leading-snug text-fatec-navy-900">{trabalho.titulo}</h3>
        <p className="mt-1 text-sm text-fatec-muted">{trabalho.areaTematica}</p>
      </div>

      {trabalho.palavrasChave.trim() && (
        <p className="text-sm text-fatec-ink">
          <span className="font-medium text-fatec-navy-900">Palavras-chave: </span>
          {trabalho.palavrasChave}
        </p>
      )}
      {trabalho.resumo && (
        <div className="text-sm leading-relaxed text-fatec-ink">
          {renderResumoFormatado(trabalho.resumo)}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-fatec-line pt-5">
        <span className="text-sm font-medium text-fatec-navy-900">
          Critérios (1 a 5 cada — a nota final é a soma)
        </span>
        {CRITERIOS.map((c) => (
          <div
            key={c.key}
            className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0 sm:max-w-sm">
              <p className="text-sm font-medium text-fatec-navy-900">{c.label}</p>
              <p className="text-xs text-fatec-muted">{c.descricao}</p>
            </div>
            <div className="flex flex-none gap-2">
              {NOTAS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNotas((prev) => ({ ...prev, [c.key]: n }))}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${
                    notas[c.key] === n
                      ? "border-fatec-orange-500 bg-fatec-orange-500 text-white"
                      : "border-fatec-line text-fatec-navy-900 hover:border-fatec-orange-500/60"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="text-sm text-fatec-muted">
          Total: <span className="font-semibold text-fatec-navy-900">{somaNotas}</span> / 25
        </p>
      </div>

      {erro && <p className="text-sm text-rose-600">{erro}</p>}

      <button
        type="button"
        disabled={!completo || enviando}
        onClick={enviar}
        className="w-fit rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
      >
        {enviando ? "Enviando..." : "Enviar nota"}
      </button>
    </div>
  );
}
