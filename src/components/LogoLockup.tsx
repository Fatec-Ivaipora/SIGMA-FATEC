/** Logo oficial do SIGMA (2026-09-08) — recebida do marketing. Duas versões
 * geradas a partir do mesmo PNG (script one-off com sharp, já rodado e
 * descartado): "cor" é o original, escrita ("IGMA") em azul escuro — só
 * legível em fundo claro. "branco" recolore só essa escrita pra branco
 * (o "S" continua azul claro, o ícone continua intocado) — pedido
 * explícito do usuário pra usar em fundo escuro (navy), onde a versão
 * original ficava com pouco contraste. */
export function LogoLockup({
  className = "h-12 w-auto",
  variant = "cor",
}: {
  className?: string;
  variant?: "cor" | "branco";
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={variant === "branco" ? "/logo-sigma-white.png" : "/logo-sigma.png"}
      alt="SIGMA Fatec"
      className={`${className} object-contain`}
    />
  );
}
