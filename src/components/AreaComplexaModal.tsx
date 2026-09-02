"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import type { AreaTematicaComplexa, SubAreaTematica } from "@/lib/data/eventos";

const SUB_AREA_VAZIA: SubAreaTematica = { nome: "", descricao: "" };

/** Criar/editar uma área temática com sub-áreas dentro (2026-09-01) — ex.:
 * "Projetos Integradores" com sub-áreas "Ciências da Saúde", "Ciências
 * Humanas" etc., cada uma com os cursos que caem ali. Reaproveitado tanto no
 * wizard de criar evento (estado local) quanto na tela Áreas temáticas
 * (grava direto no Firestore) — quem chama decide o que fazer em onSalvar/
 * onRemover, esse componente só monta o formulário. */
export function AreaComplexaModal({
  open,
  grupoInicial,
  onClose,
  onSalvar,
  onRemover,
}: {
  open: boolean;
  grupoInicial: AreaTematicaComplexa | null;
  onClose: () => void;
  onSalvar: (grupo: AreaTematicaComplexa) => void;
  onRemover?: () => void;
}) {
  const [nomeGrupo, setNomeGrupo] = useState("");
  const [subAreas, setSubAreas] = useState<SubAreaTematica[]>([SUB_AREA_VAZIA]);

  useEffect(() => {
    if (!open) return;
    Promise.resolve().then(() => {
      setNomeGrupo(grupoInicial?.nomeGrupo ?? "");
      setSubAreas(
        grupoInicial?.subAreas && grupoInicial.subAreas.length > 0
          ? grupoInicial.subAreas
          : [SUB_AREA_VAZIA],
      );
    });
  }, [open, grupoInicial]);

  function atualizarSubArea(i: number, campo: keyof SubAreaTematica, valor: string) {
    setSubAreas((prev) => prev.map((s, idx) => (idx === i ? { ...s, [campo]: valor } : s)));
  }

  function adicionarSubArea() {
    setSubAreas((prev) => [...prev, { ...SUB_AREA_VAZIA }]);
  }

  function removerSubArea(i: number) {
    setSubAreas((prev) => prev.filter((_, idx) => idx !== i));
  }

  const valido = nomeGrupo.trim() && subAreas.some((s) => s.nome.trim());

  function salvar() {
    if (!valido) return;
    const grupo: AreaTematicaComplexa = {
      id: grupoInicial?.id ?? crypto.randomUUID(),
      nomeGrupo: nomeGrupo.trim(),
      subAreas: subAreas
        .filter((s) => s.nome.trim())
        .map((s) => ({
          nome: s.nome.trim(),
          ...(s.descricao?.trim() ? { descricao: s.descricao.trim() } : {}),
        })),
    };
    onSalvar(grupo);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={grupoInicial ? "Editar área com sub-áreas" : "Nova área com sub-áreas"}
      size="lg"
    >
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fatec-navy-900">
            Nome do grupo <span className="text-fatec-orange-600">*</span>
          </span>
          <input
            type="text"
            value={nomeGrupo}
            onChange={(e) => setNomeGrupo(e.target.value)}
            placeholder="Ex.: Projetos Integradores"
            className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
          />
          <span className="text-xs text-fatec-muted">
            Cada sub-área abaixo vira uma área selecionável própria, com o
            nome &quot;{nomeGrupo.trim() || "Grupo"} – nome da sub-área&quot;.
          </span>
        </label>

        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-fatec-navy-900">
            Sub-áreas <span className="text-fatec-orange-600">*</span>
          </span>
          {subAreas.map((s, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border border-fatec-line p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={s.nome}
                  onChange={(e) => atualizarSubArea(i, "nome", e.target.value)}
                  placeholder="Ex.: Ciências da Saúde"
                  className="min-w-0 flex-1 rounded-lg border border-fatec-line bg-white px-3 py-2 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
                />
                <button
                  type="button"
                  aria-label="Remover sub-área"
                  onClick={() => removerSubArea(i)}
                  disabled={subAreas.length === 1}
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-fatec-muted transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
              <input
                type="text"
                value={s.descricao ?? ""}
                onChange={(e) => atualizarSubArea(i, "descricao", e.target.value)}
                placeholder="Cursos que entram aqui (opcional) — ex.: Biomedicina, Enfermagem, Fisioterapia e Medicina"
                className="rounded-lg border border-fatec-line bg-white px-3 py-2 text-xs text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={adicionarSubArea}
            className="flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-fatec-line px-3 py-2 text-xs font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Adicionar sub-área
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-fatec-line pt-4">
          {onRemover ? (
            <button
              type="button"
              onClick={onRemover}
              className="text-sm font-semibold text-rose-600 hover:text-rose-700"
            >
              Remover grupo
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={salvar}
            disabled={!valido}
            className="rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
          >
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}
