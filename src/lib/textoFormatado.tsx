import type { ReactNode } from "react";

/** Converte negrito/itálico leve (**negrito**, *itálico*) + parágrafos em
 * React de verdade — nunca `dangerouslySetInnerHTML`, então não existe
 * risco de injeção mesmo com texto digitado por qualquer aluno. Pensado pro
 * campo Resumo do trabalho de evento completo (2026-10-09, pedido explícito
 * do usuário — faltava negrito/itálico/parágrafo legível; achado junto: a
 * tela do avaliador nem preservava as quebras de linha que o aluno já
 * digitava). Sintaxe reconhecida: `**negrito**`, `*itálico*`; CADA Enter já
 * vira um parágrafo novo (2026-10-09, ajustado depois do usuário testar —
 * exigir linha em branco pra parágrafo, como markdown "de verdade", não
 * bateu com a expectativa de "aperta Enter e já quebra o parágrafo", tipo
 * Word). Linha em branco (Enter duas vezes) vira parágrafo vazio e some
 * (`.filter`), não uma lacuna enorme. Texto sem nenhuma marcação (resumos
 * antigos) renderiza igual a antes, só com parágrafos de verdade. */
export function renderResumoFormatado(texto: string): ReactNode {
  return texto
    .split("\n")
    .filter((linha) => linha.trim())
    .map((linha, idx) => (
      <p key={idx} className={idx > 0 ? "mt-3" : undefined}>
        {renderTrechoComEstilo(linha)}
      </p>
    ));
}

// **negrito** OU *itálico* num regex só — a alternância testa o grupo de
// negrito primeiro, então um "**x**" nunca é lido como itálico com
// asteriscos sobrando.
const REGEX_ESTILO = /\*\*(.+?)\*\*|\*(.+?)\*/g;

function renderTrechoComEstilo(linha: string): ReactNode[] {
  const partes: ReactNode[] = [];
  let ultimoIndice = 0;
  let chave = 0;
  for (const match of linha.matchAll(REGEX_ESTILO)) {
    if (match.index > ultimoIndice) {
      partes.push(linha.slice(ultimoIndice, match.index));
    }
    if (match[1] !== undefined) {
      partes.push(<strong key={chave++}>{match[1]}</strong>);
    } else {
      partes.push(<em key={chave++}>{match[2]}</em>);
    }
    ultimoIndice = match.index + match[0].length;
  }
  if (ultimoIndice < linha.length) partes.push(linha.slice(ultimoIndice));
  return partes;
}
