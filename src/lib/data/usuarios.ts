"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AtribuicaoEvento, Papel, PapelAvaliacao } from "@/lib/auth";

export type UsuarioRegistro = {
  uid: string;
  nome: string;
  email: string;
  papel: Papel;
  atribuicoesEventos?: AtribuicaoEvento[];
  eventosPermitidos?: string[];
  vinculoFatec?: boolean;
  ra?: string;
  curso?: string;
  papeisAvaliacao?: PapelAvaliacao[];
};

/** Lista todos os usuários cadastrados (RF-26: organizacao/admin podem ver).
 * Carrega a coleção inteira de uma vez (com onSnapshot, ao vivo) — pensado
 * pra uso pontual tipo "mapear uid → nome" (ver /trabalhos). A própria tela
 * /usuarios NÃO usa mais esse hook (ver useUsuariosPaginado/useBuscaUsuarios
 * abaixo, 2026-10-05) — a lista inteira de usuários só tende a crescer, e
 * reconstruir/reler tudo isso toda vez que alguém abre a tela de usuários é
 * leitura demais pro Firestore sem necessidade nenhuma. */
export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioRegistro[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    return onSnapshot(collection(db, "usuarios"), (snap) => {
      setUsuarios(
        snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UsuarioRegistro),
      );
      setCarregando(false);
    });
  }, []);

  return { usuarios, carregando };
}

const TAMANHO_PAGINA_USUARIOS = 20;

/** Página de usuários (2026-10-05, pedido explícito do usuário: "isso faz
 * muitas requisições... podemos criar paginação com limite de 20 por
 * página") — em vez do onSnapshot acima (lê a coleção inteira, ao vivo, pra
 * sempre), cada chamada aqui lê só os 20 docs da página atual, uma vez (sem
 * tempo real — não tem problema, não é uma tela que precisa atualizar
 * sozinha). Filtrar por papel acontece no servidor (precisa do índice
 * composto papel+nome no Firestore — se faltar, o erro no console do
 * navegador já vem com o link pronto pra criar, é só clicar). Os filtros de
 * vínculo/curso (só dentro de "Aluno") continuam só no cliente, sobre a
 * página já carregada — combiná-los todos como where() também explodiria em
 * vários índices compostos (papel+vínculo+curso+nome...) pra um ganho bem
 * menor, já que são refinamentos dentro de um papel que já veio filtrado. */
export function useUsuariosPaginado(papel: Papel | "todos") {
  const [usuarios, setUsuarios] = useState<UsuarioRegistro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [temProximaPagina, setTemProximaPagina] = useState(false);
  // Mensagem amigável (2026-10-05) — sem isso, um índice composto faltando
  // ou ainda "building" (pode levar uns minutos depois de criado, ver
  // comentário acima) derrubava a tela inteira com a tela de erro crua do
  // Next.js em vez de um aviso dentro do layout normal.
  const [erro, setErro] = useState<string | null>(null);
  // Cursor (último doc) de cada página já visitada, pra poder voltar sem
  // reler do zero — Firestore só pagina "pra frente" (startAfter), então
  // "página anterior" é só mudar o número e deixar esse índice decidir.
  const cursoresRef = useRef<QueryDocumentSnapshot<DocumentData>[]>([]);

  useEffect(() => {
    setPagina(0);
    cursoresRef.current = [];
  }, [papel]);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);

    async function buscar() {
      const restricoes =
        papel === "todos" ? [orderBy("nome")] : [where("papel", "==", papel), orderBy("nome")];
      const cursorAnterior = pagina > 0 ? cursoresRef.current[pagina - 1] : undefined;
      // +1 só pra saber se existe próxima página, sem precisar de outra
      // leitura (count() cobraria outra consulta à parte).
      const q = cursorAnterior
        ? query(
            collection(db, "usuarios"),
            ...restricoes,
            startAfter(cursorAnterior),
            limit(TAMANHO_PAGINA_USUARIOS + 1),
          )
        : query(collection(db, "usuarios"), ...restricoes, limit(TAMANHO_PAGINA_USUARIOS + 1));

      try {
        const snap = await getDocs(q);
        if (cancelado) return;
        const docsPagina = snap.docs.slice(0, TAMANHO_PAGINA_USUARIOS);
        setUsuarios(docsPagina.map((d) => ({ uid: d.id, ...d.data() }) as UsuarioRegistro));
        setTemProximaPagina(snap.docs.length > TAMANHO_PAGINA_USUARIOS);
        if (docsPagina.length > 0) cursoresRef.current[pagina] = docsPagina[docsPagina.length - 1];
        setErro(null);
      } catch (e) {
        if (cancelado) return;
        const mensagem = e instanceof Error ? e.message : String(e);
        setUsuarios([]);
        setTemProximaPagina(false);
        setErro(
          mensagem.includes("currently building")
            ? "O índice desse filtro ainda está sendo criado no Firestore — leva só alguns minutos, tenta de novo daqui a pouco."
            : mensagem.includes("requires an index")
              ? "Falta um índice no Firestore pra esse filtro — veja o link no console do navegador (F12) pra criar."
              : "Não foi possível carregar os usuários agora.",
        );
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    buscar();
    return () => {
      cancelado = true;
    };
  }, [papel, pagina]);

  return { usuarios, carregando, pagina, setPagina, temProximaPagina, erro };
}

/** Busca por nome ou e-mail (2026-10-05) — dispara direto no Firestore em
 * vez de filtrar a coleção inteira em memória, então funciona junto com a
 * paginação acima sem precisar carregar todo mundo. É busca por PREFIXO
 * (como o Firestore suporta nativamente, sem um serviço de busca de
 * verdade tipo Algolia) — "mateus" acha "Mateus Silva", mas não acha
 * "Carlos Mateus". Usa `nomeBusca` (nome em minúsculo, gravado em todo
 * ponto que cria/edita usuário — ver cadastro/aluno e /api/usuarios) pra
 * não depender de maiúscula/minúscula bater com o que a pessoa digitou. */
export function useBuscaUsuarios(termoBruto: string) {
  const [resultado, setResultado] = useState<UsuarioRegistro[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const termo = termoBruto.trim().toLowerCase();

  useEffect(() => {
    if (!termo) {
      setResultado([]);
      setCarregando(false);
      setErro(null);
      return;
    }
    let cancelado = false;
    setCarregando(true);
    const fim = termo + "";

    async function buscar() {
      try {
        const [porNome, porEmail] = await Promise.all([
          getDocs(
            query(
              collection(db, "usuarios"),
              orderBy("nomeBusca"),
              where("nomeBusca", ">=", termo),
              where("nomeBusca", "<", fim),
              limit(TAMANHO_PAGINA_USUARIOS),
            ),
          ),
          getDocs(
            query(
              collection(db, "usuarios"),
              orderBy("email"),
              where("email", ">=", termo),
              where("email", "<", fim),
              limit(TAMANHO_PAGINA_USUARIOS),
            ),
          ),
        ]);
        if (cancelado) return;
        const mapa = new Map<string, UsuarioRegistro>();
        for (const d of porNome.docs) mapa.set(d.id, { uid: d.id, ...d.data() } as UsuarioRegistro);
        for (const d of porEmail.docs) mapa.set(d.id, { uid: d.id, ...d.data() } as UsuarioRegistro);
        setResultado(Array.from(mapa.values()));
        setErro(null);
      } catch {
        if (cancelado) return;
        setResultado([]);
        setErro("Não foi possível buscar agora.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    buscar();
    return () => {
      cancelado = true;
    };
  }, [termo]);

  return { resultado, carregando, erro };
}

export type AlunoParaBusca = { uid: string; nome: string; email: string };

/** Lista contas de aluno (Fatec ou externo) para o aluno buscar colegas na
 * hora de submeter um trabalho (RF-08), ou pro orientador convidar pra uma
 * turma do Projeto Integrador (RF-53 — aí só Fatec, `apenasFatec`, já que
 * participante externo não tem essa vertente). Lê usuariosPublicos (2026-09-08,
 * corrige achado do pentest) — um espelho só com nome/email/vinculoFatec de
 * quem é aluno, nunca o doc usuarios/{uid} inteiro (que tem cpf/dataNascimento).
 * Por isso não precisa mais filtrar por papel aqui: só aluno tem espelho. */
export function useAlunosParaBusca(
  meuUid: string | null | undefined,
  opcoes?: {
    apenasFatec?: boolean;
    // Taxa de inscrição (2026-08-26): quando definido, só alunos com uid
    // presente no Set aparecem na busca — usado pra restringir convite de
    // colega aos que já completaram a Etapa 1 (pagamento) do evento.
    restringirA?: Set<string>;
  },
) {
  const [alunos, setAlunos] = useState<AlunoParaBusca[]>([]);
  const apenasFatec = opcoes?.apenasFatec ?? false;
  const restringirA = opcoes?.restringirA;

  useEffect(() => {
    return onSnapshot(collection(db, "usuariosPublicos"), (snap) => {
      setAlunos(
        snap.docs
          .filter((d) => d.id !== meuUid)
          .filter((d) => !apenasFatec || d.data().vinculoFatec !== false)
          .filter((d) => !restringirA || restringirA.has(d.id))
          .map((d) => ({ uid: d.id, nome: d.data().nome, email: d.data().email })),
      );
    });
  }, [meuUid, apenasFatec, restringirA]);

  return alunos;
}

export function atualizarAtribuicoesUsuario(
  uid: string,
  atribuicoesEventos: AtribuicaoEvento[],
) {
  return updateDoc(doc(db, "usuarios", uid), {
    atribuicoesEventos,
    eventosPermitidos: atribuicoesEventos.map((a) => a.eventoId),
  });
}

/** Papéis combináveis (2026-08-26) — admin adiciona/retira avaliador/
 * orientador/moderador de um usuário. Sempre inclui o papel primário na
 * lista, pra ficar consistente com o que temPapel()/firestore.rules esperam. */
export function atualizarPapeisAvaliacaoUsuario(
  uid: string,
  papel: Papel,
  papeisAvaliacao: PapelAvaliacao[],
) {
  const conjunto = new Set<PapelAvaliacao>(papeisAvaliacao);
  if (["avaliador", "orientador", "moderador"].includes(papel)) {
    conjunto.add(papel as PapelAvaliacao);
  }
  return updateDoc(doc(db, "usuarios", uid), {
    papeisAvaliacao: Array.from(conjunto),
  });
}

