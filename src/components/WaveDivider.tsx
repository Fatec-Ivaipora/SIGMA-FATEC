/** Curva entre seções da home pública (2026-11-13, pedido explícito do
 * usuário — "vamos dar... curvas"). `fill` é a cor da seção que vem
 * DEPOIS (a curva "cobre" o fim reto da seção de cima com a cor de
 * baixo) — por isso cada chamada passa a cor certa em vez de fixar uma só
 * aqui. `preserveAspectRatio="none"` estica a curva pra largura real da
 * tela sem distorcer a leitura dela (é só uma forma, não teria "razão
 * certa" de aspecto pra preservar). */
export function WaveDivider({ fill, className = "" }: { fill: string; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 90"
      preserveAspectRatio="none"
      className={`block h-10 w-full md:h-16 ${className}`}
    >
      <path d="M0,32 C 320,90 1120,0 1440,46 L1440,90 L0,90 Z" fill={fill} />
    </svg>
  );
}
