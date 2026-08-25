"use client";

import Script from "next/script";

/** Widget oficial de acessibilidade do governo (Libras) — vlibras.gov.br.
 * Fica disponível em todas as páginas via layout raiz, não só na home,
 * já que acessibilidade não deve depender de qual tela o visitante está. */
export function VLibrasWidget() {
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
          const w = window as unknown as { VLibras?: new (url: string) => unknown };
          if (w.VLibras) new w.VLibras("https://vlibras.gov.br/app");
        }}
      />
    </>
  );
}
