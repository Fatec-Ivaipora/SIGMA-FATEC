"use client";

import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { CheckCircle2, ClipboardCheck, GraduationCap, Scale, Users } from "lucide-react";
import { db } from "@/lib/firebase";
import { SiteHeader } from "@/components/SiteHeader";

function formatarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

type Interesse = "avaliador" | "moderador";

export default function SejaAvaliadorPage() {
  const [temEventoDestaque, setTemEventoDestaque] = useState(false);
  useEffect(() => {
    const q = query(collection(db, "eventos"), where("destaque", "==", true), limit(1));
    return onSnapshot(q, (snap) => setTemEventoDestaque(!snap.empty));
  }, []);

  const [nome, setNome] = useState("");
  const [areaFormacao, setAreaFormacao] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [interesses, setInteresses] = useState<Interesse[]>([]);
  // Honeypot (2026-10-28) — campo escondido do humano via CSS, só um robô
  // de preenchimento automático enxerga e preenche. Ver /api/candidatos.
  const [empresa, setEmpresa] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  function alternarInteresse(valor: Interesse) {
    setInteresses((atual) =>
      atual.includes(valor) ? atual.filter((i) => i !== valor) : [...atual, valor],
    );
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (interesses.length === 0) {
      setErro("Marque se você quer ser avaliador(a), moderador(a), ou os dois.");
      return;
    }

    setEnviando(true);
    try {
      const resposta = await fetch("/api/candidatos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          areaFormacao: areaFormacao.trim(),
          telefone,
          email: email.trim().toLowerCase(),
          interesses,
          empresa,
        }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(corpo?.erro ?? "Não foi possível enviar agora. Tente de novo.");
        setEnviando(false);
        return;
      }
      setEnviado(true);
    } catch (e) {
      console.error("Seja avaliador: falha de rede ao enviar", e);
      setErro("Não foi possível enviar. Confira sua conexão com a internet e tente de novo.");
      setEnviando(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col bg-fatec-navy-50">
      <SiteHeader mostrarEvento={temEventoDestaque} />

      <div className="flex-1 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-4xl">
          <span className="text-sm font-semibold uppercase tracking-[-0.01em] text-fatec-sky-600">
            Participe
          </span>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.01em] text-fatec-navy-900 md:text-4xl">
            Quer ser avaliador(a) ou moderador(a) nos nossos eventos?
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-fatec-muted">
            A Fatec Ivaiporã conta com professores e profissionais da área
            pra avaliar e conduzir as apresentações dos eventos acadêmicos
            (como a Mostra Acadêmica Científica). Deixe seus dados abaixo
            que nossa comissão científica entra em contato quando precisar
            de alguém com o seu perfil.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-2xl border border-fatec-line bg-white p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                <Scale className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="text-base font-semibold text-fatec-navy-900">O que faz um(a) avaliador(a)</p>
              <p className="text-sm leading-relaxed text-fatec-muted">
                Lê e avalia os trabalhos submetidos pelos alunos dentro da
                sua área de formação, atribuindo notas e pareceres conforme
                os critérios do evento.
              </p>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-fatec-line bg-white p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-fatec-navy-50 text-fatec-navy-800">
                <Users className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="text-base font-semibold text-fatec-navy-900">O que faz um(a) moderador(a)</p>
              <p className="text-sm leading-relaxed text-fatec-muted">
                Conduz as apresentações orais/rodas de conversa no dia do
                evento e avalia as apresentações — organiza o tempo,
                apresenta os trabalhos e atribui notas/pareceres conforme
                os critérios do evento.
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-fatec-line bg-white p-6 md:p-10">
            {enviado ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-7 w-7" strokeWidth={1.75} />
                </span>
                <p className="text-lg font-semibold text-fatec-navy-900">
                  Recebemos suas informações!
                </p>
                <p className="max-w-sm text-sm text-fatec-muted">
                  Te mandamos um e-mail confirmando. Nossa comissão
                  científica entra em contato quando precisar de alguém com
                  o seu perfil.
                </p>
              </div>
            ) : (
              <form onSubmit={enviar} className="flex flex-col gap-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-fatec-navy-900">
                  <ClipboardCheck className="h-4 w-4 flex-none text-fatec-sky-600" strokeWidth={1.75} />
                  Seus dados
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-fatec-navy-900">Nome completo</span>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome completo"
                    className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-fatec-navy-900">Área de formação</span>
                  <input
                    type="text"
                    required
                    value={areaFormacao}
                    onChange={(e) => setAreaFormacao(e.target.value)}
                    placeholder="Ex.: Enfermagem, Engenharia Civil, Pedagogia..."
                    className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
                  />
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-fatec-navy-900">Telefone</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      required
                      autoComplete="tel"
                      maxLength={15}
                      value={telefone}
                      onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-fatec-navy-900">E-mail</span>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@email.com"
                      className="rounded-xl border border-fatec-line bg-white px-4 py-2.5 text-sm text-fatec-ink placeholder:text-fatec-muted/70 outline-none transition-colors focus:border-fatec-sky-600"
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-fatec-navy-900">
                    Quero ser (marque uma ou as duas)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => alternarInteresse("avaliador")}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                        interesses.includes("avaliador")
                          ? "border-fatec-orange-500 bg-fatec-orange-50 text-fatec-orange-600"
                          : "border-fatec-line text-fatec-navy-900 hover:bg-fatec-navy-50"
                      }`}
                    >
                      Avaliador(a)
                    </button>
                    <button
                      type="button"
                      onClick={() => alternarInteresse("moderador")}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                        interesses.includes("moderador")
                          ? "border-fatec-orange-500 bg-fatec-orange-50 text-fatec-orange-600"
                          : "border-fatec-line text-fatec-navy-900 hover:bg-fatec-navy-50"
                      }`}
                    >
                      Moderador(a)
                    </button>
                  </div>
                </div>

                {/* Honeypot — invisível pra gente, visível só pra bot de
                    preenchimento automático (ver /api/candidatos). */}
                <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label>
                    Empresa
                    <input
                      type="text"
                      name="empresa"
                      tabIndex={-1}
                      autoComplete="off"
                      value={empresa}
                      onChange={(e) => setEmpresa(e.target.value)}
                    />
                  </label>
                </div>

                {erro && (
                  <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{erro}</p>
                )}

                <button
                  type="submit"
                  disabled={enviando}
                  className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-fatec-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
                >
                  <GraduationCap className="h-4 w-4" strokeWidth={1.75} />
                  {enviando ? "Enviando..." : "Enviar minhas informações"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
