"use client";

import { useEffect, useId, useRef, useState } from "react";
import { auth } from "@/lib/firebase";

/** Campo de nome de professor com sugestões do Edubox (2026-10-27, pedido
 * explícito do usuário) — usado no orientador e nos coorientadores do envio
 * de trabalho. Nada aparece até o aluno digitar pelo menos 3 letras; aí
 * busca em /api/professores/buscar (ignora acento e maiúscula) e mostra até
 * 8 nomes pra clicar (ou setas + Enter). Continua sendo texto livre: se o
 * professor não estiver na lista (ex.: de fora da Fatec), o que foi digitado
 * vale do mesmo jeito. */
const MINIMO = 3;

export function CampoNomeProfessor({
  value,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(-1);
  // Termo que foi buscado e não achou ninguém (2026-10-27, pedido explícito
  // do usuário — "deixar claro pro aluno que, se não encontrar o professor,
  // pode digitar o nome completo e salvar"). Só vale enquanto o campo ainda
  // tem exatamente esse texto.
  const [semResultadoPara, setSemResultadoPara] = useState<string | null>(null);
  // Só busca quando a mudança veio da digitação — escolher uma sugestão (ou
  // abrir o formulário já preenchido, na edição) não dispara busca nova.
  const digitou = useRef(false);
  const listaId = useId();

  useEffect(() => {
    if (!digitou.current) return;
    const termo = value.trim();
    // Abaixo do mínimo não busca; a lista some sozinha (ver `mostrar` abaixo).
    if (termo.length < MINIMO) return;
    let cancelado = false;
    const espera = setTimeout(async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return;
        const res = await fetch(`/api/professores/buscar?q=${encodeURIComponent(termo)}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const corpo = (await res.json().catch(() => null)) as { nomes?: string[] } | null;
        if (cancelado) return;
        const encontrados = corpo?.nomes ?? [];
        setSemResultadoPara(res.ok && encontrados.length === 0 ? termo : null);
        // Se o que está escrito já é exatamente um dos nomes, não insiste.
        const nomes = encontrados.filter((n) => n !== termo);
        setSugestoes(nomes);
        setDestaque(-1);
        setAberto(nomes.length > 0);
      } catch {
        if (!cancelado) setSugestoes([]);
      }
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [value]);

  function escolher(nome: string) {
    digitou.current = false;
    onChange(nome);
    setSugestoes([]);
    setAberto(false);
  }

  const mostrar = aberto && sugestoes.length > 0 && value.trim().length >= MINIMO;
  const naoEncontrado =
    !disabled && semResultadoPara !== null && semResultadoPara === value.trim();

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!mostrar) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setDestaque((d) => (d + 1) % sugestoes.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDestaque((d) => (d <= 0 ? sugestoes.length - 1 : d - 1));
    } else if (e.key === "Enter" && destaque >= 0) {
      e.preventDefault();
      escolher(sugestoes[destaque]);
    } else if (e.key === "Escape") {
      setAberto(false);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          digitou.current = true;
          onChange(e.target.value);
        }}
        onKeyDown={aoTeclar}
        onFocus={() => sugestoes.length > 0 && setAberto(true)}
        // Pequeno atraso pra deixar o clique na sugestão acontecer antes de fechar.
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={mostrar}
        aria-controls={listaId}
        aria-autocomplete="list"
        autoComplete="off"
        className={`w-full rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-50 disabled:text-fatec-muted ${className}`}
      />
      {mostrar && (
        <ul
          id={listaId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-fatec-line bg-white py-1 shadow-lg"
        >
          {sugestoes.map((nome, i) => (
            <li key={nome} role="option" aria-selected={i === destaque}>
              <button
                type="button"
                // onMouseDown em vez de onClick: acontece antes do blur do input.
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(nome);
                }}
                className={`block w-full px-4 py-2 text-left text-sm transition-colors ${
                  i === destaque ? "bg-fatec-navy-50 text-fatec-navy-900" : "text-fatec-ink hover:bg-fatec-navy-50"
                }`}
              >
                {nome}
              </button>
            </li>
          ))}
          <li className="px-4 pb-1 pt-1.5 text-[11px] text-fatec-muted">
            Professores da Fatec (Edubox). Não é nenhum deles? Continue digitando o nome
            completo — ele será salvo do jeito que você escrever.
          </li>
        </ul>
      )}
      {naoEncontrado && (
        <p className="mt-1.5 rounded-lg bg-fatec-sky-100 px-3 py-2 text-xs text-fatec-navy-900">
          Nenhum professor da Fatec encontrado com esse nome. Sem problema:{" "}
          <strong>digite o nome completo</strong> do professor e siga normalmente — ele será
          salvo do jeito que você escrever.
        </p>
      )}
    </div>
  );
}
