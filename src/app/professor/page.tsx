"use client";

import { Award, ClipboardCheck, GraduationCap, LayoutGrid } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { temPapel } from "@/lib/auth";

/** "Lobby" de quem foi cadastrado como "Professor" (2026-11-27, pedido
 * explícito do usuário — "cadastrar a pessoa somente e aí ele cai em um
 * cargo simples professor, esse cargo não remete a nada, ele só está no
 * sistema, neutro"). Pousa aqui no primeiro login, ou sempre que não tiver
 * (ainda) nenhuma capacidade de avaliação atribuída em nenhum evento —
 * nunca redireciona pra /avaliador ou /orientador direto, porque essa
 * pessoa pode ter ZERO papeisAvaliacao ainda (acabou de ser cadastrada,
 * só suplente de olho num evento de TCC) e aquelas telas rejeitariam ela
 * de volta pra cá, num loop. Assim que a organização/admin atribuir
 * avaliador/orientador/moderador (editando o usuário em /usuarios), os
 * atalhos correspondentes aparecem aqui sozinhos. */
export default function ProfessorPage() {
  const { perfil, carregando } = useRequireAuth(["professor"]);

  if (carregando || !perfil) return null;

  const souAvaliacao = temPapel(perfil, "avaliador") || temPapel(perfil, "moderador");
  const souOrientador = temPapel(perfil, "orientador");

  const atalhos = [
    souAvaliacao && {
      href: "/avaliador",
      icone: ClipboardCheck,
      titulo: "Avaliação",
      descricao: "Eventos, trabalhos e banca de TCC em que você avalia ou modera.",
    },
    souOrientador && {
      href: "/orientador",
      icone: GraduationCap,
      titulo: "Orientação",
      descricao: "TCCs que você orienta.",
    },
  ].filter((a): a is { href: string; icone: typeof ClipboardCheck; titulo: string; descricao: string } => !!a);
  // Certificações sempre visível (2026-11-27, pedido explícito do usuário —
  // quem foi avaliador/moderador de um evento já encerrado volta pra
  // "professor", ver f07030b, e precisa continuar baixando a declaração).
  // Não conta como "função atribuída": a mensagem do topo continua dizendo
  // que a conta não tem função quando só existe este atalho.
  const temFuncao = atalhos.length > 0;
  atalhos.push({
    href: "/avaliador/certificacoes",
    icone: Award,
    titulo: "Certificações",
    descricao: "Declarações dos eventos em que você avaliou ou moderou trabalhos.",
  });

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={[
          { label: "Início", href: "/professor", icon: LayoutGrid },
          { label: "Certificações", href: "/avaliador/certificacoes", icon: Award },
        ]}
        activeHref="/professor"
        userName={perfil.nome}
        userRoleLabel="Professor"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
      />

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Olá, {perfil.nome.split(" ")[0]}
          </h1>
          <p className="text-sm text-fatec-muted">
            {temFuncao
              ? "Escolha onde entrar:"
              : "Sua conta ainda não tem nenhuma função atribuída em nenhum evento."}
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {!temFuncao && (
            <p className="mb-4 rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-6 text-center text-sm text-fatec-muted">
              Fale com a organização/coordenação do seu curso pra ser atribuído(a) como
              avaliador(a), orientador(a) ou suplente de algum evento.
            </p>
          )}
          {(
            <div className="grid gap-4 sm:grid-cols-2">
              {atalhos.map((a) => (
                <a
                  key={a.href}
                  href={a.href}
                  className="flex flex-col gap-3 rounded-2xl border border-fatec-line bg-white p-5 transition-colors hover:border-fatec-sky-600"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                    <a.icone className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="font-semibold text-fatec-navy-900">{a.titulo}</p>
                    <p className="mt-0.5 text-sm text-fatec-muted">{a.descricao}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
