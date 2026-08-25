"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, ROTA_POR_PAPEL, type Papel } from "@/lib/auth";

export function useRequireAuth(papeisPermitidos?: Papel[]) {
  const { user, perfil, carregando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (carregando) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!perfil) return;

    if (papeisPermitidos && !papeisPermitidos.includes(perfil.papel)) {
      router.replace(ROTA_POR_PAPEL[perfil.papel]);
    }
  }, [user, perfil, carregando, papeisPermitidos, router]);

  return { user, perfil, carregando: carregando || (!!user && !perfil) };
}
