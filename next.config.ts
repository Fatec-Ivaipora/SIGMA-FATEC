import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.2.3.35"],
  // firebase-admin tem uma dependência ESM (via jwks-rsa -> jose) que o
  // Turbopack não empacota corretamente pra rota de API serverless na
  // Vercel (ERR_REQUIRE_ESM) — deixa como pacote externo, resolvido pelo
  // Node em vez de empacotado. Isso sozinho NÃO resolve se o jose puxado
  // for a v6 (ESM puro) — firebase-admin precisa continuar em ^13.x (ver
  // package.json e o incidente de 2026-09-28 em INFO.md → Histórico de
  // mudanças) pra puxar jose v4, que é CJS-compatível.
  serverExternalPackages: ["firebase-admin"],
  // Headers de segurança (2026-09-08, achado no pentest) — a Vercel não
  // adiciona nenhum desses por padrão. frame-ancestors + X-Frame-Options
  // barram clickjacking; nosniff evita MIME-sniffing; Referrer-Policy evita
  // vazar a URL completa (com querystring) pra terceiros em links externos.
  // CSP começa permissiva o bastante pra não quebrar Firebase Auth/Firestore
  // (que fala com *.googleapis.com/*.firebaseio.com) e o Google Fonts já
  // usado no projeto — 'unsafe-inline'/'unsafe-eval' em script-src porque o
  // Next injeta bootstrap inline; dá pra apertar depois com nonce se quiser.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // camera=(self) (2026-09-23) — confirmação de presença por QR
            // code (evento simples) precisa da câmera do navegador pra
            // escanear; microfone/geolocalização continuam bloqueados.
            value: "camera=(self), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              // blob: — preview local de imagem antes do upload (BannerCropModal
              // usa createObjectURL, achado 2026-09-09 ao testar troca de banner).
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.googleapis.com https://*.google.com https://*.firebaseio.com wss://*.firebaseio.com",
              // https://www.google.com liberado (2026-09-19) pro iframe do
              // Google Maps Embed API na home (src/app/page.tsx) — sem
              // isso o CSP barra o próprio navegador de carregar o mapa,
              // mostrando "conteúdo bloqueado" mesmo com a chave/API certas.
              "frame-src 'self' https://*.firebaseapp.com https://www.google.com",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
