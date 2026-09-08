import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.2.3.35"],
  // firebase-admin (via jwks-rsa -> jose) tem uma dependência ESM que o
  // Turbopack não empacota corretamente pra rota de API serverless na
  // Vercel (ERR_REQUIRE_ESM) — deixa como pacote externo, resolvido pelo
  // Node em vez de empacotado.
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
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://*.googleapis.com https://*.google.com https://*.firebaseio.com wss://*.firebaseio.com",
              "frame-src 'self' https://*.firebaseapp.com",
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
