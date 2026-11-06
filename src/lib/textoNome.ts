// Padrão do sistema (2026-11-06, pedido explícito do usuário — "todos os
// nomes... sempre tem que ser o padrão do programa"): nome de pessoa
// digitado livre é sempre salvo em caixa alta. Só na gravação, daqui pra
// frente — não migra dado antigo já salvo em minúsculo/misto. Mesmo
// `.toLocaleUpperCase("pt-BR")` já usado no PDF do ensalamento (acentuação
// correta em português).
export function caixaAltaNome(nome: string): string {
  return nome.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
}
