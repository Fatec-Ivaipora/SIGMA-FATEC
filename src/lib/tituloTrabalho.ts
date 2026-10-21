/** Título do trabalho sempre em CAIXA ALTA na exibição (2026-10-21, pedido
 * explícito do usuário — cada aluno digitava/colava de um jeito, tudo
 * minúsculo, tudo maiúsculo ou misturado). Só na exibição (telas,
 * certificado, e-mails, feed): o que está gravado no Firestore continua
 * exatamente como o aluno enviou, então dá pra voltar atrás sem perder
 * nada e vale também pros trabalhos enviados antes dessa data. */
export function tituloExibicao(titulo: string | null | undefined): string {
  return (titulo ?? "").toLocaleUpperCase("pt-BR");
}
