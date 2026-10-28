/** Regra de busca de nome de professor (2026-10-27) — separada da rota
 * /api/professores/buscar pra poder ser testada sozinha com a lista real.
 * Ignora acento e maiúscula ("jessica" acha "Jéssica"); cada palavra
 * digitada precisa aparecer em alguma parte do nome ("jes silv" acha
 * "Jéssica da Silva"); quem começa uma palavra com o termo vem primeiro. */

export const MINIMO_LETRAS = 3;
export const LIMITE_SUGESTOES = 8;

export function normalizarNome(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buscarNomes(nomes: string[], digitado: string): string[] {
  const termo = normalizarNome(digitado);
  if (termo.length < MINIMO_LETRAS) return [];
  const partes = termo.split(" ");
  const comBusca = nomes.map((nome) => ({ nome, busca: normalizarNome(nome) }));
  const achados = comBusca.filter((p) => partes.every((parte) => p.busca.includes(parte)));
  const comecaPalavra = (p: { busca: string }) =>
    partes.every((parte) => p.busca.split(" ").some((palavra) => palavra.startsWith(parte)));
  achados.sort(
    (a, b) => Number(comecaPalavra(b)) - Number(comecaPalavra(a)) || a.nome.localeCompare(b.nome, "pt-BR"),
  );
  return achados.slice(0, LIMITE_SUGESTOES).map((p) => p.nome);
}
