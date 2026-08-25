import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.2.3.35"],
  // firebase-admin (via jwks-rsa -> jose) tem uma dependência ESM que o
  // Turbopack não empacota corretamente pra rota de API serverless na
  // Vercel (ERR_REQUIRE_ESM) — deixa como pacote externo, resolvido pelo
  // Node em vez de empacotado.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
