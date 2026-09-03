/** Validação de CPF por dígito verificador (2026-09-03) — mais rigorosa que
 * o "só conferir 11 dígitos" usado no fluxo de pagamento (InscricaoEventoModal),
 * porque agora o CPF também precisa passar pela validação real do Edubox
 * (função sis_validacpf no banco deles) na hora do lançamento do aluno —
 * melhor pegar erro de digitação aqui do que só lá na frente. */
export function validarCPF(valor: string): boolean {
  const cpf = valor.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  function digitoVerificador(base: string): number {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += parseInt(base[i], 10) * (base.length + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  }

  const d1 = digitoVerificador(cpf.slice(0, 9));
  const d2 = digitoVerificador(cpf.slice(0, 10));
  return d1 === parseInt(cpf[9], 10) && d2 === parseInt(cpf[10], 10);
}

/** "000.000.000-00" — só formatação visual, aceita string parcial (aplica
 * a máscara progressivamente enquanto a pessoa digita). */
export function formatarCPF(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  return digitos
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
