"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { User } from "firebase/auth";
import { Modal } from "@/components/Modal";

type Situacao = "criar" | "atualizar" | "ja_estava" | "aluno" | "sem_email" | "email_invalido" | "repetido";
type Resultado = { linha: number; nome: string; email: string; situacao: Situacao; senhaTemporaria?: string; erro?: string };

const ROTULO: Record<Situacao, { texto: string; cor: string }> = {
  criar: { texto: "Conta nova", cor: "text-emerald-700" },
  atualizar: { texto: "Já tem conta — ganha a função", cor: "text-fatec-sky-600" },
  ja_estava: { texto: "Já tem essa função no evento", cor: "text-fatec-muted" },
  aluno: { texto: "Conta de aluno — fica de fora", cor: "text-amber-700" },
  sem_email: { texto: "Sem e-mail — fica de fora", cor: "text-amber-700" },
  email_invalido: { texto: "E-mail inválido — fica de fora", cor: "text-rose-700" },
  repetido: { texto: "E-mail repetido na planilha", cor: "text-amber-700" },
};

// Lê CSV do Excel (";" ou ",") ou linhas coladas do Excel (tab), com aspas.
function lerTabela(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, "");
  const sep = limpo.includes("\t") ? "\t" : limpo.split(/\r?\n/)[0].includes(";") || limpo.includes(";") ? ";" : ",";
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpo[i + 1] === "\n") i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = "";
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.map((l) => l.map((x) => x.replace(/ /g, " ").trim()));
}

// Acha as colunas de nome e e-mail pelo cabeçalho; sem cabeçalho, usa a 1ª e a 2ª.
// Linhas de título de seção ("AGRONOMIA") e vazias ficam de fora.
function extrairPessoas(texto: string): { nome: string; email: string }[] {
  const tabela = lerTabela(texto).filter((l) => l.some(Boolean));
  const iCab = tabela.findIndex((l) => l.some((c) => /nome/i.test(c)) && l.some((c) => /e-?mail/i.test(c)));
  const cab = iCab >= 0 ? tabela[iCab] : null;
  const colNome = cab ? cab.findIndex((c) => /nome/i.test(c)) : 0;
  const colEmail = cab ? cab.findIndex((c) => /e-?mail/i.test(c)) : 1;
  return tabela
    .slice(iCab >= 0 ? iCab + 1 : 0)
    .filter((l) => !(l.some((c) => /nome/i.test(c)) && l.some((c) => /e-?mail/i.test(c))))
    .filter((l) => l.filter(Boolean).length >= 2 || /@/.test(l[colEmail] ?? ""))
    .map((l) => ({ nome: l[colNome] ?? "", email: l[colEmail] ?? "" }))
    .filter((p) => p.nome || p.email);
}

/** Cadastro em lote (2026-11-05, pedido explícito do usuário — ver
 * /api/usuarios/lote). Só Admin. Planilha (CSV ou colada do Excel) com nome e
 * e-mail -> prévia (nada é criado) -> confirmar -> lista com as senhas
 * temporárias pra repassar. Quem já tem conta não é duplicado. */
export function CadastroLoteModal({
  open,
  onClose,
  user,
  eventos,
}: {
  open: boolean;
  onClose: () => void;
  user: User | null | undefined;
  eventos: { id: string; nome: string }[];
}) {
  const [eventoId, setEventoId] = useState("");
  const [papel, setPapel] = useState<"moderador" | "avaliador" | "orientador">("moderador");
  const [texto, setTexto] = useState("");
  const [previa, setPrevia] = useState<Resultado[] | null>(null);
  const [final, setFinal] = useState<Resultado[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    setTexto(""); setPrevia(null); setFinal(null); setErro(null);
    onClose();
  }

  async function chamar(simular: boolean) {
    if (!user) return;
    setErro(null);
    const pessoas = extrairPessoas(texto);
    if (!eventoId) { setErro("Escolha o evento."); return; }
    if (pessoas.length === 0) { setErro("Não encontrei nenhuma linha com nome e e-mail."); return; }
    setCarregando(true);
    try {
      const res = await fetch("/api/usuarios/lote", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ eventoId, papel, linhas: pessoas, simular }),
      });
      const corpo = await res.json().catch(() => null);
      if (!res.ok) setErro(corpo?.erro ?? "Não foi possível processar a planilha.");
      else if (simular) setPrevia(corpo.resultados);
      else setFinal(corpo.resultados);
    } catch {
      setErro("Não foi possível processar a planilha.");
    }
    setCarregando(false);
  }

  function baixarSenhas() {
    if (!final) return;
    const evento = eventos.find((e) => e.id === eventoId)?.nome ?? "";
    const csv = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = [["Nome", "E-mail (login)", "Senha temporária", "Situação", "Evento"]].concat(
      final.map((r) => [r.nome, r.email, r.senhaTemporaria ?? "", r.erro ? `ERRO: ${r.erro}` : ROTULO[r.situacao].texto, evento]),
    );
    const blob = new Blob(["﻿" + linhas.map((l) => l.map(csv).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cadastro-em-lote-${papel}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const lista = final ?? previa;
  const conta = (s: Situacao) => (lista ?? []).filter((r) => r.situacao === s).length;

  return (
    <Modal open={open} onClose={fechar} title="Cadastro em lote">
      <div className="flex flex-col gap-4">
        {!lista && (
          <>
            <p className="text-sm text-fatec-muted">
              Envie uma planilha com as colunas <strong>Nome</strong> e <strong>E-mail</strong> (arquivo CSV salvo pelo
              Excel) ou cole as linhas copiadas do Excel. Antes de criar, o sistema mostra o que vai acontecer com cada
              pessoa. Quem já tem conta não é duplicado — só ganha a função e o vínculo com o evento.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-fatec-navy-900">
                Evento
                <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} className="rounded-lg border border-fatec-line px-3 py-2 text-sm">
                  <option value="">Escolha…</option>
                  {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-fatec-navy-900">
                Papel
                <select value={papel} onChange={(e) => setPapel(e.target.value as typeof papel)} className="rounded-lg border border-fatec-line px-3 py-2 text-sm">
                  <option value="moderador">Moderador(a)</option>
                  <option value="avaliador">Avaliador(a)</option>
                  <option value="orientador">Orientador(a)</option>
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium text-fatec-navy-900">
              Arquivo CSV
              <input
                type="file"
                accept=".csv,.txt"
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) setTexto(await f.text()); }}
                className="text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-fatec-navy-900">
              Ou cole aqui as linhas do Excel
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={6}
                placeholder={"Nome\tE-mail\nFULANO DE TAL\tfulano@gmail.com"}
                className="rounded-lg border border-fatec-line px-3 py-2 font-mono text-xs"
              />
            </label>
            {texto && <p className="text-xs text-fatec-muted">{extrairPessoas(texto).length} pessoa(s) encontrada(s) na planilha.</p>}
          </>
        )}

        {lista && (
          <>
            <p className="text-sm text-fatec-navy-900">
              {final ? "Pronto:" : "Prévia (nada foi criado ainda):"} <strong className="text-emerald-700">{conta("criar")} conta(s) nova(s)</strong> ·{" "}
              <strong className="text-fatec-sky-600">{conta("atualizar")} ganham a função</strong> · {conta("ja_estava")} já estavam ·{" "}
              {conta("aluno") + conta("sem_email") + conta("email_invalido") + conta("repetido")} ficam de fora
            </p>
            <div className="max-h-80 overflow-auto rounded-xl border border-fatec-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-fatec-line text-left text-xs uppercase tracking-wide text-fatec-muted">
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">E-mail</th>
                    <th className="px-3 py-2">Situação</th>
                    {final && <th className="px-3 py-2">Senha temporária</th>}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((r) => (
                    <tr key={r.linha} className="border-b border-fatec-line last:border-0">
                      <td className="px-3 py-1.5">{r.nome || "—"}</td>
                      <td className="px-3 py-1.5 text-fatec-muted">{r.email || "—"}</td>
                      <td className={`px-3 py-1.5 font-semibold ${r.erro ? "text-rose-700" : ROTULO[r.situacao].cor}`}>
                        {r.erro ? `Erro: ${r.erro}` : ROTULO[r.situacao].texto}
                      </td>
                      {final && <td className="px-3 py-1.5 font-mono">{r.senhaTemporaria ?? ""}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {final && (
              <p className="text-xs text-fatec-muted">
                Cada pessoa nova recebeu um e-mail avisando do cadastro. Repasse a senha temporária — no primeiro acesso o
                SIGMA pede para trocar. Baixe a lista agora: as senhas não ficam guardadas para ver de novo.
              </p>
            )}
          </>
        )}

        {erro && <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{erro}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          {!final && previa && (
            <button type="button" onClick={() => setPrevia(null)} className="rounded-xl border border-fatec-line px-4 py-2 text-sm font-semibold text-fatec-navy-900 hover:bg-fatec-navy-50">
              Voltar
            </button>
          )}
          {!lista && (
            <button
              type="button"
              onClick={() => chamar(true)}
              disabled={carregando}
              className="flex items-center gap-1.5 rounded-xl bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-fatec-orange-600 disabled:opacity-60"
            >
              {carregando && <Loader2 className="h-4 w-4 animate-spin" />}
              Ver prévia
            </button>
          )}
          {previa && !final && (
            <button
              type="button"
              onClick={() => chamar(false)}
              disabled={carregando || conta("criar") + conta("atualizar") === 0}
              className="flex items-center gap-1.5 rounded-xl bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-fatec-orange-600 disabled:opacity-60"
            >
              {carregando && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar contas
            </button>
          )}
          {final && (
            <>
              <button type="button" onClick={baixarSenhas} className="flex items-center gap-1.5 rounded-xl bg-fatec-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-fatec-orange-600">
                <Download className="h-4 w-4" />
                Baixar lista com as senhas
              </button>
              <button type="button" onClick={fechar} className="rounded-xl border border-fatec-line px-4 py-2 text-sm font-semibold text-fatec-navy-900 hover:bg-fatec-navy-50">
                Fechar
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
