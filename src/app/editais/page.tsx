"use client";

import { useEffect, useState } from "react";
import { ArrowRight, FileText, FolderOpen } from "lucide-react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SiteHeader } from "@/components/SiteHeader";
import { useEditais } from "@/lib/data/editais";

export default function EditaisPublicoPage() {
  const { editais, carregando } = useEditais();

  // Mesmo cabeçalho da home (2026-09-04, pedido explícito: "igualzinho") —
  // por isso repete aqui a mesma checagem de evento em destaque que a home
  // usa, só pra saber se mostra o botão "Evento" no menu.
  const [temEventoDestaque, setTemEventoDestaque] = useState(false);
  useEffect(() => {
    const q = query(collection(db, "eventos"), where("destaque", "==", true), limit(1));
    return onSnapshot(q, (snap) => setTemEventoDestaque(!snap.empty));
  }, []);

  return (
    <main className="flex flex-1 flex-col bg-fatec-navy-50">
      <SiteHeader mostrarEvento={temEventoDestaque} />

      <div className="flex-1 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[96rem]">
          <span className="text-sm font-semibold uppercase tracking-[-0.01em] text-fatec-sky-600">
            Documentos oficiais
          </span>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.01em] text-fatec-navy-900 md:text-4xl">
            Editais
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-fatec-muted">
            Aqui estão só os editais dos eventos acadêmicos da Fatec Ivaiporã
            — inscrições, normas de submissão, critérios de avaliação e afins.
            Clique num card pra abrir o PDF completo.
          </p>

          {!carregando && editais.length === 0 && (
            <div className="mt-12 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-fatec-line bg-white px-6 py-20 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-fatec-navy-50 text-fatec-navy-800">
                <FolderOpen className="h-7 w-7" strokeWidth={1.75} />
              </span>
              <p className="font-medium text-fatec-navy-900">
                Nenhum edital publicado no momento
              </p>
              <p className="max-w-sm text-sm text-fatec-muted">
                Assim que a organização publicar um edital, ele aparece aqui.
              </p>
            </div>
          )}

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {editais.map((edital) => (
              <a
                key={edital.id}
                href={edital.arquivoUrl}
                target="_blank"
                rel="noreferrer"
                className="group flex flex-col gap-4 rounded-2xl border border-fatec-line bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:border-fatec-sky-600 hover:shadow-lg"
              >
                <span className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-fatec-navy-50 text-fatec-navy-800 transition-colors group-hover:bg-fatec-sky-100 group-hover:text-fatec-sky-600">
                  <FileText className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <div className="flex-1">
                  <p className="text-lg font-semibold leading-snug text-fatec-navy-900">
                    {edital.titulo}
                  </p>
                  {edital.descricao && (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-fatec-muted">
                      {edital.descricao}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 border-t border-fatec-line pt-4 text-sm font-semibold text-fatec-sky-600">
                  Ver edital
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2}
                  />
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
