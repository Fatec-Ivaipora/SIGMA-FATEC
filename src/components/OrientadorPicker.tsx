"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { auth } from "@/lib/firebase";

export type OrientadorEscolhido = { uid: string; nome: string };

// Minúsculo e sem acento — mesmo critério de busca de colega em
// SubmeterTrabalhoModal.tsx ("cassia" acha "Cássia").
function semAcento(texto: string): string {
  return (texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Abreviações de título que alunos às vezes digitam junto do nome
// (2026-11-25, caso real — aluno mandou print dizendo que não achava a
// orientadora "Milena" porque tinha digitado "PROFº DRº Milena"; a busca
// de antes comparava a FRASE inteira com o nome, então qualquer palavra a
// mais quebrava o match). Ignoradas palavra por palavra na busca — sobra
// só o nome de verdade pra comparar.
const TITULOS_IGNORADOS = new Set([
  "prof",
  "profo",
  "profa",
  "professor",
  "professora",
  "dr",
  "dro",
  "dra",
  "doutor",
  "doutora",
]);

function ehTitulo(palavra: string): boolean {
  return TITULOS_IGNORADOS.has(palavra.replace(/[.ºª]/g, ""));
}

/** Escolha do orientador pra inscrição de TCC (2026-11-16, pedido explícito
 * do usuário) — diferente do `nomeOrientador` texto livre da MAC
 * (`CampoNomeProfessor`), aqui precisa ser um usuário REAL do sistema, com
 * uid, porque ele entra na banca (disponibilidade, nota, certificado). Lista
 * vem de `/api/orientadores?eventoId=` — só quem já foi atribuído a esse
 * evento pelo admin em /usuarios (mesmo mecanismo de atribuição de
 * avaliador/moderador, ver AtribuicaoEvento em auth.tsx). Rota é servidor
 * porque firestore.rules não deixa aluno ler o doc de outro usuário. */
export function OrientadorPicker({
  eventoId,
  value,
  onChange,
  disabled = false,
}: {
  eventoId: string;
  value: OrientadorEscolhido | null;
  onChange: (valor: OrientadorEscolhido | null) => void;
  disabled?: boolean;
}) {
  const [orientadores, setOrientadores] = useState<OrientadorEscolhido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCarregando(true);
      setErro(false);
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return;
        const res = await fetch(
          `/api/orientadores?eventoId=${encodeURIComponent(eventoId)}`,
          { headers: { Authorization: `Bearer ${idToken}` } },
        );
        const corpo = (await res.json().catch(() => null)) as
          | { orientadores?: OrientadorEscolhido[] }
          | null;
        if (cancelado) return;
        if (!res.ok) {
          setErro(true);
          setOrientadores([]);
        } else {
          setOrientadores(corpo?.orientadores ?? []);
        }
      } catch {
        if (!cancelado) setErro(true);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [eventoId]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2.5 rounded-xl border border-fatec-line bg-fatec-navy-50 px-4 py-2.5">
        <span className="text-sm font-medium text-fatec-navy-900">{value.nome}</span>
        {!disabled && (
          <button
            type="button"
            aria-label="Trocar orientador"
            onClick={() => onChange(null)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-fatec-muted transition-colors hover:bg-fatec-navy-100 hover:text-fatec-navy-900"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </div>
    );
  }

  // Separa também por ponto, não só espaço (2026-11-25, achado real —
  // "prof.milene", sem espaço nenhum entre o título e o nome, continuava
  // batendo como 1 token só e não achava ninguém).
  const palavrasBusca = semAcento(busca)
    .split(/[\s.]+/)
    .filter(Boolean);
  const termos = palavrasBusca.filter((p) => !ehTitulo(p));
  const buscaTinhaTitulo = palavrasBusca.some(ehTitulo);
  const sugestoes = termos.length
    ? orientadores.filter((o) => {
        const alvo = semAcento(o.nome);
        return termos.every((t) => alvo.includes(t));
      })
    : orientadores;

  return (
    <div className="relative">
      <input
        type="text"
        disabled={disabled || carregando}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder={carregando ? "Carregando orientadores..." : "Pesquise somente pelo nome (sem Prof., Dr., etc.)"}
        className="w-full rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-50"
      />
      {!carregando && busca.trim().length > 0 && sugestoes.length > 0 && (
        <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-xl border border-fatec-line bg-white shadow-lg">
          {sugestoes.map((o) => (
            <button
              key={o.uid}
              type="button"
              onClick={() => {
                onChange(o);
                setBusca("");
              }}
              className="block w-full px-4 py-2.5 text-left text-sm font-medium text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
            >
              {o.nome}
            </button>
          ))}
        </div>
      )}
      {buscaTinhaTitulo && (
        <p className="mt-1.5 text-xs text-fatec-muted">
          Pesquise somente pelo nome — títulos como &quot;Prof.&quot;/&quot;Dr.&quot; são
          ignorados na busca.
        </p>
      )}
      {erro && (
        <p className="mt-1.5 text-xs text-rose-600">
          Não foi possível carregar a lista de orientadores agora.
        </p>
      )}
      {!carregando && !erro && orientadores.length === 0 && (
        <p className="mt-1.5 text-xs text-amber-600">
          Nenhum orientador atribuído a esse evento ainda — peça pra
          organização atribuir seu orientador em Usuários antes de se
          inscrever.
        </p>
      )}
    </div>
  );
}
