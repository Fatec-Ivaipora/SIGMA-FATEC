"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

/** Widget oficial de acessibilidade do governo (Libras) — vlibras.gov.br.
 * Fica disponível em todas as páginas via layout raiz, não só na home,
 * já que acessibilidade não deve depender de qual tela o visitante está.
 *
 * Só carrega em telas de PC (2026-09-09, pedido do usuário) — o script
 * oficial deles tem um comportamento próprio de aparecer/sumir por tamanho
 * de tela que ficou invertido do que a gente queria (aparecia só no celular,
 * sumia no PC). Como isso vem de dentro do plugin deles (não tem prop nem
 * CSS nosso controlando isso), a forma confiável de garantir "só no PC" é
 * nem montar o widget quando a tela é estreita — mesmo breakpoint `md`
 * (768px) usado no resto do app. Sem SSR (useState/useEffect) porque o
 * tamanho real da tela só existe no navegador.
 */
export function VLibrasWidget() {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    Promise.resolve().then(() => setMostrar(mq.matches));
    const ouvir = (e: MediaQueryListEvent) => setMostrar(e.matches);
    mq.addEventListener("change", ouvir);
    return () => mq.removeEventListener("change", ouvir);
  }, []);

  if (!mostrar) return null;

  return (
    <>
      <div
        // Markup exigido pelo script oficial (atributos não padrão como
        // "vw"/"vw-access-button" não existem na tipagem do React) — via
        // dangerouslySetInnerHTML em vez de JSX tipado.
        dangerouslySetInnerHTML={{
          __html:
            '<div vw class="enabled"><div vw-access-button class="active"></div><div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div></div>',
        }}
      />
      <Script
        src="https://vlibras.gov.br/app/vlibras-plugin.js"
        strategy="afterInteractive"
        onLoad={() => {
          const w = window as unknown as {
            VLibras?: { Widget: new (url: string) => unknown };
          };
          if (w.VLibras) new w.VLibras.Widget("https://vlibras.gov.br/app");
        }}
      />
    </>
  );
}
