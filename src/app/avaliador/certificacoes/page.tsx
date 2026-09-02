"use client";

import { useMemo, useState } from "react";
import { Award, Clock, Download, Loader2 } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { navParaPerfil } from "@/lib/navAvaliacao";
import { useRequireAuth } from "@/lib/useRequireAuth";
import { useEventos } from "@/lib/data/eventos";
import { useTrabalhos } from "@/lib/data/trabalhos";
import { baixarCertificado } from "@/lib/baixarCertificado";

type Papel = "avaliador" | "moderador";

type Grupo = {
  eventoId: string;
  papel: Papel;
  algumAceito: boolean;
  algumLiberado: boolean;
};

export default function AvaliadorCertificacoesPage() {
  const { user, perfil, carregando } = useRequireAuth(["avaliador", "moderador"]);
  const { trabalhos } = useTrabalhos(perfil, user?.uid);
  const { eventos } = useEventos(perfil);

  const [baixandoChave, setBaixandoChave] = useState<string | null>(null);
  const [erroChave, setErroChave] = useState<{ chave: string; msg: string } | null>(null);

  // Uma declaração por (evento, papel) — não por trabalho: a mesma pessoa
  // avalia/modera vários trabalhos do mesmo evento, mas recebe uma só
  // declaração (2026-08-28). "Aguardando liberação" aparece assim que tem
  // pelo menos 1 trabalho aceito, mesmo antes da organização liberar.
  const grupos = useMemo(() => {
    if (!user) return [];
    const mapa = new Map<string, Grupo>();

    function registrar(eventoId: string, papel: Papel, aceito: boolean, liberado: boolean) {
      const chave = `${eventoId}_${papel}`;
      const atual = mapa.get(chave) ?? { eventoId, papel, algumAceito: false, algumLiberado: false };
      atual.algumAceito = atual.algumAceito || aceito;
      atual.algumLiberado = atual.algumLiberado || liberado;
      mapa.set(chave, atual);
    }

    for (const t of trabalhos) {
      const aceito = t.status === "aceito";
      const liberado = aceito && !!t.certificadoLiberado;
      if (t.avaliadorUid === user.uid) registrar(t.eventoId, "avaliador", aceito, liberado);
      if (t.moderadorUid === user.uid) registrar(t.eventoId, "moderador", aceito, liberado);
    }

    return Array.from(mapa.values()).filter((g) => g.algumAceito);
  }, [trabalhos, user]);

  async function baixar(g: Grupo) {
    if (!user) return;
    const chave = `${g.eventoId}_${g.papel}`;
    setErroChave(null);
    setBaixandoChave(chave);
    const resultado = await baixarCertificado(user, {
      papel: g.papel,
      eventoId: g.eventoId,
    });
    if (!resultado.ok) setErroChave({ chave, msg: resultado.erro });
    setBaixandoChave(null);
  }

  if (carregando || !perfil || !user) return null;

  return (
    <main className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        navItems={navParaPerfil(perfil)}
        activeHref="/avaliador/certificacoes"
        userName={perfil.nome}
        userRoleLabel="Avaliador"
        userInitials={(perfil.nome || "?").slice(0, 2).toUpperCase()}
        showAjuda
      />

      <div className="flex flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-fatec-line bg-white px-6 py-5 md:px-10">
          <h1 className="text-xl font-bold tracking-[-0.01em] text-fatec-navy-900">
            Certificações
          </h1>
          <p className="text-sm text-fatec-muted">
            Declarações emitidas por sua participação como avaliador(a) ou
            moderador(a) — uma por evento.
          </p>
        </header>

        <div className="flex-1 px-6 py-8 md:px-10">
          {grupos.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                <Award className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <p className="font-medium text-fatec-navy-900">
                Nenhuma declaração ainda
              </p>
              <p className="max-w-sm text-sm text-fatec-muted">
                Declarações aparecem aqui assim que um trabalho que você
                avaliou ou moderou tiver o resultado final aceito — o
                download libera depois que a organização confirmar o evento.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {grupos.map((g) => {
                const chave = `${g.eventoId}_${g.papel}`;
                return (
                  <div
                    key={chave}
                    className="flex flex-col gap-2 rounded-2xl border border-fatec-line bg-white p-5"
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-fatec-orange-100 text-fatec-orange-600">
                        <Award className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-fatec-navy-900">
                          {eventos.find((e) => e.id === g.eventoId)?.nome ?? g.eventoId}
                        </p>
                        <p className="text-sm text-fatec-muted">
                          {g.papel === "avaliador" ? "Avaliação" : "Apresentação"}
                        </p>
                      </div>
                      {g.algumLiberado ? (
                        <button
                          type="button"
                          onClick={() => baixar(g)}
                          disabled={baixandoChave === chave}
                          className="flex flex-none items-center gap-1.5 rounded-xl bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
                        >
                          {baixandoChave === chave ? (
                            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                          ) : (
                            <Download className="h-4 w-4" strokeWidth={1.75} />
                          )}
                          Baixar declaração
                        </button>
                      ) : (
                        <span className="flex flex-none items-center gap-1.5 text-xs font-medium text-fatec-muted">
                          <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Aguardando liberação
                        </span>
                      )}
                    </div>
                    {erroChave?.chave === chave && (
                      <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                        {erroChave.msg}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
