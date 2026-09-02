import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { VLibrasWidget } from "@/components/VLibrasWidget";
import { SenhaTemporariaGate } from "@/components/SenhaTemporariaGate";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "SIGMA Fatec · Fatec Ivaiporã",
  description:
    "Submissão, avaliação e certificação de trabalhos acadêmicos da Fatec Ivaiporã.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${poppins.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-[var(--background)]"
        suppressHydrationWarning
      >
        {/*
          THESIS: Institutional infrastructure, not a generic SaaS admin template —
          Fatec's own navy/orange identity at full strength, never diluted to pastel.
          OWN-WORLD: Navy #0e3a5e owns structural regions (hero, header, sidebar);
          orange #ea741c is the single accent, one primary action per screen; sky
          #2376b9 for secondary links/info. Poppins throughout. 12-16px radii, soft
          shadows, no gradients or glass.
          STORY: This is Fatec Ivaiporã's official portal for academic submissions;
          visitor sees one clear action, then exactly where their work stands.
          FIRST VIEWPORT: Home — full-bleed navy hero, logo, headline, orange
          "Entrar". Login — centered card, orange primary, two cadastro paths.
          Dashboard — fixed navy sidebar, light content, status cards, table.
          FORM: Institutional-portal form, expanded from Fatec's pinned brand
          (official site palette/logo/font); scope was three literally-specified
          screens, not an open concept roll.
          FINISH: unreviewed and undocumented is unfinished; this build ends with
          the finish review, the verdict, and DESIGN.md
        */}
        <AuthProvider>
          {children}
          <SenhaTemporariaGate />
        </AuthProvider>
        <VLibrasWidget />
      </body>
    </html>
  );
}
