"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, MessageCircle, Search, UserPlus } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { NAV_ADMIN } from "@/lib/navAdmin";
import { useRequireAuth } from "@/lib/useRequireAuth";

type Candidato = {
  id: string;
  nome: string;
  areaFormacao: string;
  telefone: string;
  email: string;
  interesses: string[];
  criadoEm: string | null;
};

const FILTROS = [
  { label: "Todos", valor: "todos" },
  { label: "Avaliador", valor: "avaliador" },
  { label: "Moderador", valor: "moderador" },
] as const;

function linkWhatsapp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  return `https://wa.me/55${digitos}`;
}

/** Lista de quem se autocadastrou querendo ser avaliador/moderador
 * (2026-10-28, pedido explícito do usuário — hoje esse convite é feito um a
 * um pelo WhatsApp, "às vezes não conhecemos a pessoa"). Só visualização e
 * contato — não cria usuário/conta automaticamente (decisão explícita do
 * usuário): criar a conta de avaliador/moderador de verdade continua sendo
 * manual em /usuarios, como hoje, depois que a comissão decide chamar essa
 * pessoa. */
export default function CandidatosPage() {
  const { user, perfil, carregando } = useRequireAuth(["admin", "organizacao"]);
  const souAdmin = perfil?.papel === "admin";

  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["valor"]>("todos");

  useEffect(() => {
    if (!user) return;
    let cancelado = false;

    (async () => {
      setCarregandoLista(true);
      try {
        const idToken = await user.getIdToken();
        const resposta = await fetch("/api/candidatos", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const corpo = await resposta.json().catch(() => null);
        if (cancelado) return;
        if (!resposta.ok) {
          setErro(corpo?.erro ?? "Não foi possível carregar os candidatos agora.");
          setCandidatos([]);
          return;
        }
        setCandidatos(corpo.candidatos ?? []);
        setErro(null);
      } catch (e) {
        if (cancelado) return;
        console.error("Candidatos: falha ao carregar lista", e);
        setErro("Não foi possível carregar os candidatos agora.");
        setCandidatos([]);
      } finally {
        if (!cancelado) setCarregandoLista(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [user]);

  const candidatosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return candidatos.filter((c) => {
      const bateFiltro = filtro === "todos" || c.interesses.includes(filtro);
      const bateBusca =
        !termo || c.nome.toLowerCase().includes(termo) || c.email.toLowerCase().includes(termo);
      return bateFiltro && bateBusca;
    });
  }, [candidatos, busca, filtro]);

  if (carregando || !perfil) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={NAV_ADMIN}
        activeHref="/candidatos"
        userName={perfil.nome}
        userRoleLabel={souAdmin ? "Admin" : "Organização"}
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
      />

      <div className="flex flex-1 flex-col overflow-x-hidden md:h-screen md:overflow-y-auto">
        <header className="flex flex-col gap-4 border-b border-fatec-line bg-white px-6 py-5 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
              Candidatos
            </h1>
            <p className="text-sm text-fatec-muted">
              Quem se cadastrou querendo ser avaliador(a) ou moderador(a) —
              entre em contato e crie o acesso em Usuários quando chamar
              alguém.
            </p>
          </div>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 rounded-xl border border-fatec-line bg-white px-4 py-2.5 sm:max-w-sm sm:flex-1">
              <Search className="h-4 w-4 flex-none text-fatec-muted" strokeWidth={1.75} />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou e-mail"
                className="min-w-0 flex-1 bg-transparent text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1 rounded-xl bg-fatec-navy-50 p-1">
              {FILTROS.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  onClick={() => setFiltro(f.valor)}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    filtro === f.valor
                      ? "bg-white text-fatec-navy-900 shadow-sm"
                      : "text-fatec-muted hover:text-fatec-navy-900"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-fatec-line bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-fatec-line text-xs uppercase tracking-[-0.01em] text-fatec-muted">
                    <th className="px-6 py-3 font-semibold">Nome</th>
                    <th className="px-6 py-3 font-semibold">Área de formação</th>
                    <th className="px-6 py-3 font-semibold">Interesse</th>
                    <th className="px-6 py-3 font-semibold">Contato</th>
                  </tr>
                </thead>
                <tbody>
                  {candidatosFiltrados.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-fatec-line last:border-0 hover:bg-fatec-navy-50/60"
                    >
                      <td className="px-6 py-4 font-medium text-fatec-navy-900">{c.nome}</td>
                      <td className="px-6 py-4 text-fatec-muted">{c.areaFormacao}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {c.interesses.map((i) => (
                            <span
                              key={i}
                              className="rounded-full bg-fatec-navy-50 px-2.5 py-1 text-xs font-semibold text-fatec-navy-800"
                            >
                              {i === "avaliador" ? "Avaliador(a)" : "Moderador(a)"}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <a
                            href={linkWhatsapp(c.telefone)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Chamar ${c.nome} no WhatsApp`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-fatec-muted transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                          >
                            <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
                          </a>
                          <a
                            href={`mailto:${c.email}`}
                            aria-label={`Enviar e-mail pra ${c.nome}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-fatec-muted transition-colors hover:bg-fatec-navy-50 hover:text-fatec-navy-900"
                          >
                            <Mail className="h-4 w-4" strokeWidth={1.75} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {candidatosFiltrados.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className={`px-6 py-10 text-center text-sm ${erro ? "text-rose-600" : "text-fatec-muted"}`}
                      >
                        {erro ??
                          (carregandoLista ? (
                            "Carregando..."
                          ) : (
                            <span className="flex flex-col items-center gap-2">
                              <UserPlus className="h-6 w-6 text-fatec-muted" strokeWidth={1.5} />
                              {busca || filtro !== "todos"
                                ? "Nenhum candidato encontrado com esse filtro."
                                : "Nenhum candidato ainda."}
                            </span>
                          ))}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
