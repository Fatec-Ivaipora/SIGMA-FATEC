/** Valida id de documento do Firestore vindo de query string em rota
 * pública sem autenticação (2026-11-16, pedido explícito do usuário — "se
 * precavenha de injeção já que é uma parte do site que fica exposta e vai
 * no banco de dados"). O Admin SDK nunca interpreta string como código
 * (não existe "SQL injection" aqui), mas um id com "/" muda a
 * profundidade do caminho que `db.doc()` lê — rejeitar isso ANTES de
 * qualquer consulta, com um 400 claro, é melhor do que deixar o Firestore
 * estourar um erro genérico lá na frente. Ids reais (auto-gerados pelo
 * Firestore) são alfanuméricos de ~20 caracteres; a faixa aceita aqui
 * (até 64, letras/números/traço/underline) é generosa de propósito pra
 * nunca barrar um id legítimo. */
const ID_FIRESTORE = /^[A-Za-z0-9_-]{1,64}$/;

export function idFirestoreValido(id: string | null): id is string {
  return !!id && ID_FIRESTORE.test(id);
}
