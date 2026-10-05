"use client";

import { useState } from "react";
import { PenTool, UserRound } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { NAV_ADMIN } from "@/lib/navAdmin";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { ASSINANTES_CERTIFICADO } from "@/lib/assinantesCertificado";

/** Cartão de 1 assinante — a imagem é só visual aqui (2026-10-05), lida
 * direto de public/certificados/assinatura-{id}.jpg pela convenção de nome
 * de arquivo (ver comentário em assinantesCertificado.ts); quem decide se o
 * PDF sai com ela ou não é o mapa IMAGEM_POR_ASSINANTE em certificadosPdf.tsx
 * (server-only, não dá pra importar aqui). Se o arquivo ainda não existir
 * (assinante cadastrado no catálogo mas sem a imagem ainda), cai no
 * placeholder em vez de mostrar um ícone de imagem quebrada. */
function CartaoAssinante({ nome, cargo, id }: { nome: string; cargo: string; id: string }) {
  const [semImagem, setSemImagem] = useState(false);
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-fatec-line bg-white p-6 text-center">
      <div className="flex h-16 w-full items-center justify-center">
        {semImagem ? (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fatec-navy-50 text-fatec-muted">
            <UserRound className="h-5 w-5" strokeWidth={1.75} />
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/certificados/assinatura-${id}.jpg`}
            alt={`Assinatura de ${nome}`}
            className="h-16 w-auto object-contain"
            onError={() => setSemImagem(true)}
          />
        )}
      </div>
      <div>
        <p className="font-medium text-fatec-navy-900">{nome}</p>
        <p className="text-sm text-fatec-muted">{cargo}</p>
      </div>
      {semImagem && (
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
          Sem assinatura digitalizada ainda
        </span>
      )}
    </div>
  );
}

export default function AssinaturasPage() {
  const { perfil, carregando } = useRequireAuth(["admin", "organizacao"]);

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={NAV_ADMIN}
        activeHref="/assinaturas"
        userName={perfil.nome}
        userRoleLabel={perfil.papel === "admin" ? "Admin" : "Organização"}
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
      />

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Assinaturas
          </h1>
          <p className="text-sm text-fatec-muted">
            Pessoas com assinatura digitalizada cadastrada no sistema. A
            partir desta lista, cada evento define quem assina o seu
            certificado, em Eventos → Dados do certificado.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ASSINANTES_CERTIFICADO.map((a) => (
              <CartaoAssinante key={a.id} id={a.id} nome={a.nome} cargo={a.cargo} />
            ))}
          </div>

          {ASSINANTES_CERTIFICADO.length === 0 && (
            <p className="rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-10 text-center text-sm text-fatec-muted">
              Nenhum assinante cadastrado ainda.
            </p>
          )}

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-fatec-line bg-fatec-navy-50 p-5">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white text-fatec-navy-800">
              <PenTool className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-fatec-muted">
              O cadastro de um novo assinante é feito manualmente. Envie o
              nome completo, o cargo e a imagem da assinatura (recortada,
              somente o traço) à equipe responsável pela manutenção do
              sistema; após o cadastro, a pessoa passa a aparecer
              automaticamente nesta lista.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
