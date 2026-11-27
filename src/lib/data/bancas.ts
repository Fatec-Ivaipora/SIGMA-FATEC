"use client";

import { useEffect, useState } from "react";
import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Trabalho } from "@/lib/data/trabalhos";

export type AvaliacaoBancaAluno = NonNullable<Trabalho["avaliacoesBanca"]>[number];
export type NotaBancaTCC = AvaliacaoBancaAluno["notas"][number];

/** disponibilidadeBanca/{eventoId}_{uid} (2026-11-16, pedido explícito do
 * usuário) — autoatendimento: cada avaliador/orientador/moderador vinculado
 * a um evento de TCC marca em que dias (dentro da janela
 * dataRealizacao..dataRealizacaoFim do evento) pode fazer parte de uma
 * banca. Isso é cruzado por `montarBancaAutomatica` abaixo — bem diferente
 * do ensalamento por sala×horário do Evento MAC (ver
 * src/lib/data/sessoes.ts), aqui não tem sala nenhuma, só dia.
 *
 * Sem capacidade/máximo por dia (2026-11-17, removido por pedido explícito
 * do usuário — marcar um dia já significa "disponível no período de
 * trabalho na instituição", sem precisar dizer quantas bancas topa fazer
 * nesse dia). `montarBancaAutomatica` espalha a carga sozinho, preferindo
 * quem ainda fez menos bancas até agora na mesma geração. */
export type DisponibilidadeBanca = {
  eventoId: string;
  uid: string;
  nome: string;
  // "AAAA-MM-DD" dos dias em que a pessoa está disponível.
  dias: string[];
};

export function useDisponibilidadeDoEvento(eventoId: string | undefined) {
  const [disponibilidades, setDisponibilidades] = useState<DisponibilidadeBanca[]>([]);
  // Lazy (2026-11-16) — já nasce "não carregando" sem eventoId, em vez de
  // começar true e precisar de um setCarregando(false) síncrono dentro do
  // efeito só pra esse caso (quem chama sem eventoId não está esperando
  // nada carregar de verdade).
  const [carregando, setCarregando] = useState(!!eventoId);

  useEffect(() => {
    if (!eventoId) return;
    const q = query(collection(db, "disponibilidadeBanca"), where("eventoId", "==", eventoId));
    return onSnapshot(q, (snap) => {
      setDisponibilidades(snap.docs.map((d) => d.data() as DisponibilidadeBanca));
      setCarregando(false);
    });
  }, [eventoId]);

  return { disponibilidades, carregando };
}

export function useMinhaDisponibilidade(eventoId: string | undefined, uid: string | undefined) {
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeBanca | null>(null);
  const [carregando, setCarregando] = useState(!!eventoId && !!uid);

  useEffect(() => {
    if (!eventoId || !uid) return;
    return onSnapshot(doc(db, "disponibilidadeBanca", `${eventoId}_${uid}`), (snap) => {
      setDisponibilidade(snap.exists() ? (snap.data() as DisponibilidadeBanca) : null);
      setCarregando(false);
    });
  }, [eventoId, uid]);

  return { disponibilidade, carregando };
}

/** Autoatendimento, sem passar por rota alguma — é a própria pessoa
 * escrevendo o próprio doc (ver regra nova em firestore.rules). */
export function salvarMinhaDisponibilidade(params: {
  eventoId: string;
  uid: string;
  nome: string;
  dias: string[];
}) {
  return setDoc(doc(db, "disponibilidadeBanca", `${params.eventoId}_${params.uid}`), {
    eventoId: params.eventoId,
    uid: params.uid,
    nome: params.nome,
    dias: params.dias,
  });
}

// Lista "AAAA-MM-DD" de cada dia entre início e fim, incluindo os dois —
// mesmo espírito de diasDoEvento (src/lib/certificadoDias.ts), mas
// devolvendo as datas em si, não só a contagem (a geração de banca precisa
// testar dia a dia, não só saber quantos são).
export function diasDoIntervalo(inicio: string, fim: string): string[] {
  if (!inicio) return [];
  const dias: string[] = [];
  const cursor = new Date(`${inicio}T00:00:00`);
  const ultimo = new Date(`${fim || inicio}T00:00:00`);
  while (cursor.getTime() <= ultimo.getTime()) {
    dias.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

export type TrabalhoParaBanca = {
  id: string;
  orientadorUid: string;
  nomeOrientador: string;
};

export type BancaGerada = {
  trabalhoId: string;
  data: string;
  sala: number;
  horario: number;
  avaliadores: { uid: string; nome: string }[];
};

// Por que ESSE trabalho específico não conseguiu banca (2026-11-17, pedido
// explícito do usuário — "quando der erro... deve aparecer um ícone que eu
// possa clicar e abrir um modal pra ver o que deu errado"). Calculado
// durante o mesmo loop de montarBancaAutomatica, não é um motivo genérico —
// reflete exatamente qual dos 3 motivos bloqueou esse trabalho.
export type OverflowBanca = { trabalhoId: string; motivo: string };

// Regra de prioridade pra UM trabalho específico na geração automática
// (2026-11-25, pedido explícito do usuário — caso real de uma aluna grávida
// que precisava apresentar numa segunda-feira específica). Sempre mira 1
// trabalho só (nunca "todos os trabalhos de um orientador") — orientador ou
// avaliador na restrição é quem TEM que estar na banca, não o alvo da
// regra. `alunoNome`/`titulo` são só um retrato pra listar a regra na tela
// sem precisar cruzar com `trabalhos` de novo. É preferência FORTE, não
// trava a geração inteira: `montarBancaAutomatica` tenta só a restrição
// pedida e, se não der (nem sacrificando mais nada), esse trabalho cai pro
// "sem banca" com motivo específico — nunca força um choque de horário nem
// desloca outro trabalho pra caber a regra. Salva em `evento.regrasPrioridadeBanca`
// (fica disponível de uma geração pra outra, editável/removível).
export type RegraPrioridadeBanca = {
  id: string;
  trabalhoId: string;
  alunoNome: string;
  titulo: string;
  prioridade: "alta" | "media" | "baixa";
  // "dia"/"avaliador" GARANTEM (tenta incluir); "evitar_dia"/"evitar_avaliador"
  // (2026-11-27, pedido explícito do usuário — caso real de conflito de
  // interesse: uma aluna não podia de jeito nenhum ser avaliada por uma
  // professora específica) EXCLUEM — mesma preferência forte dos outros
  // dois: tenta evitar, mas se for literalmente impossível (único jeito de
  // montar a banca passa pela pessoa/dia a evitar) cai pro overflow com
  // motivo específico, nunca inclui a pessoa/dia escondido.
  restricao:
    | { tipo: "dia"; data: string }
    | { tipo: "avaliador"; uid: string; nome: string }
    | { tipo: "evitar_dia"; data: string }
    | { tipo: "evitar_avaliador"; uid: string; nome: string };
};

// Prioridade de sala POR PESSOA, não por trabalho (2026-11-27, pedido
// explícito do usuário — "preciso que seja por avaliador também", caso
// real de logística/acessibilidade: uma pessoa específica precisa cair
// sempre na mesma sala, em TODAS as bancas em que ela participar, sem
// precisar marcar trabalho por trabalho). Só existe a versão "garantir"
// (não foi pedida uma versão "evitar sala"). Preferência forte igual às
// outras regras: tenta essa sala primeiro, mas cai pra outra sala livre
// sem bloquear a banca se a preferida já estiver ocupada nesse horário —
// nunca gera overflow por causa disso (ver comentário em `salaPorUid`
// dentro de montarBancaAutomatica). Quando precisa mesmo trocar de sala
// (2026-11-27, achado real — "a Mari" caiu na sala 2 num horário e sala 1
// no horário seguinte, sem tempo de trocar), o algoritmo tenta não deixar
// a pessoa em salas diferentes em horários VIZINHOS (ver
// `temConflitoDeBufferDeSala`) — mas só isso: não garante intervalo maior
// que 1 horário, só evita o caso zero-tempo-pra-trocar.
export type RegraSalaAvaliador = {
  id: string;
  avaliadorUid: string;
  avaliadorNome: string;
  sala: number;
};

// Prioridade de DIA por pessoa (2026-11-27, pedido explícito do usuário —
// "nas regras de criação de banca, nas regras dos avaliadores, preciso que
// tenha a regra dos dias pra eles também, alta prioridade pro avaliador no
// dia X") — mesmo espírito de RegraSalaAvaliador acima, só que pro dia em
// vez da sala. Preferência forte: tenta esse dia primeiro, sem bloquear a
// banca se não der (nunca gera overflow por causa disso).
//
// LIMITAÇÃO HONESTA (estrutural, não é bug): o dia é escolhido ANTES de
// saber quem vai ser avaliador de uma banca — só o orientador é conhecido
// de antemão. Por isso essa regra só consegue de fato ADIANTAR o dia
// tentado quando a pessoa é ORIENTADORA do trabalho; quando ela só entra
// como uma das 2 avaliadoras (escolha que só acontece depois do dia já
// fixado), a regra não tem como influenciar qual dia é tentado primeiro —
// mesma limitação, pelo mesmo motivo estrutural, que RegraSalaAvaliador já
// tem pra sala quando a pessoa nunca é orientadora de nada.
export type RegraDiaAvaliador = {
  id: string;
  avaliadorUid: string;
  avaliadorNome: string;
  dia: string; // "AAAA-MM-DD"
};

/** Função pura determinística (first-fit, sem IA — mesmo espírito de
 * montarGradeAutomatica em sessoes.ts, só que cruzando DIA×HORÁRIO×SALA×
 * PESSOA). Pra cada trabalho, acha o primeiro dia (na ordem de `dias`) em
 * que: (1) o orientador está disponível (ele SEMPRE entra na banca do
 * próprio orientando, pedido explícito do usuário, confirmado em 100% dos
 * certificados reais de 2025), (2) existem pelo menos 2 OUTRAS pessoas
 * disponíveis nesse mesmo dia, e (3) ainda sobra pelo menos 1 sala que não
 * bateu `maxBancasPorDia` nesse dia.
 *
 * `maxBancasPorDia` é POR SALA, não total do dia (2026-11-24, pedido
 * explícito do usuário — "o máximo de bancas por dia tem que ser o máximo
 * de banca por sala no dia": reflete que cada sala roda bancas em
 * sequência dentro da janela de tempo física da instituição, então o teto
 * de "quantas bancas cabem" é por sala — com N salas, a capacidade do dia
 * inteiro é `maxBancasPorDia × numeroSalas`, não `maxBancasPorDia` sozinho
 * como antes). `maxBancasPorDia` ausente = sem teto (comportamento de
 * antes), em qualquer número de salas.
 *
 * Conflito de horário real entre salas (2026-11-24, pedido explícito do
 * usuário — "não pode acontecer de uma pessoa ser avaliadora na sala 1 às
 * 19h e orientador às 19h na sala 2"): dentro de cada dia, as bancas
 * também ocupam um "horário" (índice 0, 1, 2...) dentro de uma sala
 * específica — nunca duas bancas na mesma sala no mesmo horário, e nunca
 * alguém (orientador ou avaliador) repetido no mesmo horário em salas
 * diferentes. Pra cada trabalho, tenta o horário 0, depois 1, 2... e,
 * dentro de cada horário, tenta cada sala em ordem — a 1ª sala que (a)
 * ainda não tem banca nesse horário, (b) ainda não bateu `maxBancasPorDia`
 * nesse dia, e (c) tem os 3 participantes livres nesse horário, recebe a
 * banca. A MESMA pessoa pode, sim, entrar em bancas diferentes no mesmo
 * dia, só não no mesmo horário (em qualquer sala). `numeroSalas` ausente
 * ou 1 = sempre 1 sala, equivalente ao comportamento de antes.
 *
 * Sem capacidade/máximo POR PESSOA no dia inteiro (2026-11-17, removido
 * antes por pedido explícito do usuário — ver comentário em
 * DisponibilidadeBanca): qualquer disponível pode entrar em quantas
 * bancas precisar no mesmo dia (em horários diferentes), até o teto de
 * SALA valer. Pra não sobrecarregar sempre as mesmas 2 pessoas, entre os
 * candidatos escolhe os 2 que ainda entraram em MENOS bancas nessa mesma
 * geração (`usosPorUid`, contador que só existe durante essa chamada —
 * não é persistido, cada geração começa do zero). O que não couber em dia
 * nenhum volta em `overflow`, com o motivo específico (orientador sem dia
 * algum disponível, dias dele todos com todas as salas no limite, ou
 * faltou avaliador nos dias válidos) — pra virar aviso detalhado na tela
 * em vez de só um número, e nunca travar o resto da geração.
 *
 * Processa trabalhos do orientador com MENOS dias disponíveis primeiro
 * (2026-11-24, pedido explícito do usuário, ver `trabalhosOrdenados` mais
 * abaixo) — sem isso, quem tem muitos dias livres podia consumir a última
 * vaga escassa de um dia que era a ÚNICA opção de outro orientador.
 *
 * Regras de prioridade (2026-11-25, pedido explícito do usuário, ver
 * RegraPrioridadeBanca) — ANTES do desempate por "menos dias disponíveis",
 * os trabalhos com regra `alta` são processados primeiro, depois `media`,
 * depois `baixa`, depois o resto (sem regra); dentro de cada grupo mantém
 * o mesmo desempate de sempre. Isso garante que quem tem prioridade
 * reivindica a vaga escassa (ex.: a única sala livre numa segunda-feira)
 * antes de outro trabalho sem regra preencher a capacidade do dia.
 *
 * Preferência FORTE, não regra dura (2026-11-25, pedido explícito do
 * usuário — "preferência forte, com aviso se não der"): um trabalho com
 * regra só tenta a restrição pedida (o dia específico, ter o avaliador
 * específico na banca, evitar um dia específico, ou evitar um avaliador
 * específico — 2026-11-27, caso real de conflito de interesse) — nunca cai
 * pra uma busca sem restrição nenhuma. Se a restrição não couber (ex.: o
 * avaliador prioritário não está disponível em dia nenhum em comum com o
 * orientador, ou a banca não fecha sem a pessoa que devia ser evitada),
 * esse trabalho específico vai pro `overflow` com um motivo próprio, SEM
 * afetar o agendamento de nenhum outro trabalho nem forçar choque de
 * horário. */
export function montarBancaAutomatica(params: {
  trabalhos: TrabalhoParaBanca[];
  disponibilidades: DisponibilidadeBanca[];
  dias: string[];
  maxBancasPorDia?: number;
  numeroSalas?: number;
  regras?: RegraPrioridadeBanca[];
  regrasSala?: RegraSalaAvaliador[];
  regrasDia?: RegraDiaAvaliador[];
}): { bancasNovas: BancaGerada[]; overflow: OverflowBanca[] } {
  const numeroSalas = Math.max(1, params.numeroSalas ?? 1);
  const diasPorUid = new Map(params.disponibilidades.map((d) => [d.uid, new Set(d.dias)]));
  const nomePorUid = new Map(params.disponibilidades.map((d) => [d.uid, d.nome]));
  const usosPorUid = new Map<string, number>();
  // Prioridade de sala POR PESSOA (2026-11-27, pedido explícito do usuário
  // — diferente das regras de RegraPrioridadeBanca, que miram 1 trabalho
  // só: essa aqui mira a PESSOA, e vale pra toda banca em que ela entrar,
  // seja como orientador(a) ou como um dos 2 avaliadores escolhidos. Só
  // "garantir" (tenta primeiro essa sala, nunca "evitar sala" — não pedido).
  const salaPorUid = new Map<string, number>();
  for (const r of params.regrasSala ?? []) salaPorUid.set(r.avaliadorUid, r.sala);
  // Prioridade de DIA por pessoa (2026-11-27) — só reordena a tentativa de
  // dias quando a pessoa é ORIENTADORA do trabalho (motivo estrutural, ver
  // comentário de RegraDiaAvaliador); aplicado dentro de `tentarAgendar`,
  // que já recebe `diasParaTentar` pronta pra cada trabalho.
  const diaPorUid = new Map<string, string>();
  for (const r of params.regrasDia ?? []) diaPorUid.set(r.avaliadorUid, r.dia);
  // Chave "dia#horario#uid" -> sala em que essa pessoa está nesse horário
  // (2026-11-27, pedido explícito do usuário — achou um caso real: "a Mari"
  // tinha prioridade de sala 1, mas numa geração ficou na sala 2 num
  // horário e sala 1 no horário SEGUINTE — sem tempo nenhum de trocar de
  // sala entre uma banca e outra). Usado só pra quem tem `salaPorUid` —
  // ver `temConflitoDeBufferDeSala` abaixo.
  const salaDaPessoaPorSlot = new Map<string, number>();
  // Chave "dia#sala" — quantas bancas essa sala já tem nesse dia (o teto
  // de verdade, POR sala, não somado entre salas).
  const bancasPorSalaDia = new Map<string, number>();
  // Chave "dia#horario" — quem já está ocupado nesse horário (qualquer
  // sala) e quais salas já estão em uso nele.
  const ocupadosPorSlot = new Map<string, Set<string>>();
  const salasUsadasPorSlot = new Map<string, Set<number>>();

  const bancasNovas: BancaGerada[] = [];
  const overflow: OverflowBanca[] = [];

  const diasValidos = new Set(params.dias);
  const diasValidosPorOrientador = (uid: string) =>
    Array.from(diasPorUid.get(uid) ?? []).filter((d) => diasValidos.has(d)).length;

  // 1 regra por trabalho (o mais recente vence, se por algum motivo vier
  // mais de uma pro mesmo id — a tela já evita isso, ver ensalamento/page.tsx).
  const regraPorTrabalho = new Map<string, RegraPrioridadeBanca>();
  for (const r of params.regras ?? []) regraPorTrabalho.set(r.trabalhoId, r);
  const PESO_PRIORIDADE: Record<RegraPrioridadeBanca["prioridade"], number> = {
    alta: 0,
    media: 1,
    baixa: 2,
  };
  const pesoDoTrabalho = (id: string) => {
    const regra = regraPorTrabalho.get(id);
    return regra ? PESO_PRIORIDADE[regra.prioridade] : 3;
  };

  // Mais restrito primeiro (2026-11-24, pedido explícito do usuário — achou
  // 3 trabalhos sem banca automática mesmo cabendo na mão: eram justamente
  // os 3 orientadores com menos dias disponíveis dentro da janela, e o
  // algoritmo processava na ordem que os trabalhos vêm do banco, deixando
  // orientadores "fáceis de encaixar" consumirem a vaga que sobraria pros
  // mais restritos). Ordena por quantos dias VÁLIDOS (dentro da janela do
  // evento) o orientador tem disponível, crescente — quem tem só 1-2 dias
  // possíveis é processado antes de quem tem a semana toda livre, então
  // ganha a vaga escassa antes dela sumir. Sort é estável (Node/V8
  // garantem isso), então empates mantêm a ordem original. Prioridade de
  // regra vem primeiro (2026-11-25), esse desempate só decide a ordem
  // DENTRO do mesmo nível de prioridade.
  const trabalhosOrdenados = [...params.trabalhos].sort((a, b) => {
    const diffPrioridade = pesoDoTrabalho(a.id) - pesoDoTrabalho(b.id);
    if (diffPrioridade !== 0) return diffPrioridade;
    return diasValidosPorOrientador(a.orientadorUid) - diasValidosPorOrientador(b.orientadorUid);
  });

  // Alguma das `pessoas` (orientador + os 2 escolhidos) tem prioridade de
  // sala E já está marcada no horário vizinho (±1, mesmo dia) numa sala
  // DIFERENTE da que está sendo testada agora? (2026-11-27) Só considera
  // quem tem `salaPorUid` — pra quem não tem prioridade de sala nenhuma,
  // trocar de sala entre horários sempre foi normal, isso aqui só evita
  // ZERO tempo de troca especificamente pra quem a gente já pediu pra
  // manter numa sala fixa.
  function temConflitoDeBufferDeSala(dia: string, horario: number, sala: number, pessoas: string[]): boolean {
    for (const uid of pessoas) {
      if (!salaPorUid.has(uid)) continue;
      for (const vizinho of [horario - 1, horario + 1]) {
        if (vizinho < 0) continue;
        const salaVizinha = salaDaPessoaPorSlot.get(`${dia}#${vizinho}#${uid}`);
        if (salaVizinha != null && salaVizinha !== sala) return true;
      }
    }
    return false;
  }

  // Uma tentativa de encaixar UM trabalho, testando só os dias de
  // `diasParaTentar` (lista restrita a 1 dia, pra regra de dia específico;
  // já vem sem o dia a evitar, pra regra de evitar dia; ou `params.dias`
  // inteiro nos outros casos) e, se `avaliadorObrigatorioUid` vier
  // preenchido, só aceitando slot em que essa pessoa entre como um dos 2
  // avaliadores; se `avaliadorProibidoUid` vier preenchido (2026-11-27),
  // essa pessoa nunca entra na lista de candidatos, mesmo se fosse o único
  // jeito de fechar a banca. `respeitarBufferSala` (2026-11-27, default
  // true) recusa um slot que deixaria alguém com prioridade de sala numa
  // sala diferente da do horário vizinho (sem tempo de troca) — é só
  // preferência, então quem chama tenta de novo com `false` se a tentativa
  // com buffer não achar nada (ver `tentarComBufferDeSala` abaixo). Já
  // grava o resultado nos mapas compartilhados e em `bancasNovas` se
  // achar — por isso só pode ser chamada 1x por trabalho (por tentativa).
  function tentarAgendar(
    t: TrabalhoParaBanca,
    diasParaTentarOriginal: string[],
    avaliadorObrigatorioUid?: string,
    avaliadorProibidoUid?: string,
    respeitarBufferSala = true,
  ): { ok: true } | { ok: false; motivo: string } {
    // Prioridade de dia POR PESSOA (2026-11-27) — se o orientador tem um
    // dia preferido marcado em `diaPorUid`, tenta ESSE dia primeiro (igual
    // `ordemSalas` já faz pra sala, só que 1 nível acima, no próprio loop
    // de dia). Só considera o orientador — pra avaliador, o dia já está
    // fixado antes de saber quem vai ser escolhido, ver limitação honesta
    // no comentário de RegraDiaAvaliador.
    const diaPreferido = diaPorUid.get(t.orientadorUid);
    const diasParaTentar =
      diaPreferido && diasParaTentarOriginal.includes(diaPreferido)
        ? [diaPreferido, ...diasParaTentarOriginal.filter((d) => d !== diaPreferido)]
        : diasParaTentarOriginal;

    // Diagnóstico (2026-11-17) — só usado se não achar no final; cada flag
    // reflete um motivo diferente, checado na ordem em que o loop de dias
    // realmente os encontra.
    let orientadorTemAlgumDiaDisponivel = false;
    let orientadorSoAchouDiasNoLimite = true;
    let faltouAvaliadorEmDiaValido = false;
    let avaliadorObrigatorioNuncaDisponivel = true;

    for (const dia of diasParaTentar) {
      if (!diasPorUid.get(t.orientadorUid)?.has(dia)) continue;
      orientadorTemAlgumDiaDisponivel = true;

      // Esse dia só vale a pena tentar se SOBRAR pelo menos 1 sala que
      // ainda não bateu o teto (por sala, não somado) — senão nenhum
      // horário vai resolver, pula pro próximo dia direto.
      const salaComVagaNoDia = (sala: number) =>
        !params.maxBancasPorDia || (bancasPorSalaDia.get(`${dia}#${sala}`) ?? 0) < params.maxBancasPorDia;
      if (!Array.from({ length: numeroSalas }, (_, i) => i + 1).some(salaComVagaNoDia)) continue;
      orientadorSoAchouDiasNoLimite = false;

      // Checagem rápida de nível-dia (ignora horário/sala) — se nem no dia
      // inteiro existem 2 outras pessoas disponíveis, nenhuma sala/horário
      // vai resolver; evita rodar o loop de horário à toa (e evita loop
      // sem fim se o dia nunca tiver gente suficiente).
      const poolDoDia = Array.from(diasPorUid.entries()).filter(
        ([uid, diasDisp]) =>
          uid !== t.orientadorUid && diasDisp.has(dia) && uid !== avaliadorProibidoUid,
      );
      if (avaliadorObrigatorioUid && poolDoDia.some(([uid]) => uid === avaliadorObrigatorioUid)) {
        avaliadorObrigatorioNuncaDisponivel = false;
      }
      if (poolDoDia.length < 2) {
        faltouAvaliadorEmDiaValido = true;
        continue;
      }
      // Esse dia não tem o avaliador exigido pela regra disponível — não
      // adianta tentar horário/sala nenhum aqui, pula direto pro próximo dia.
      if (avaliadorObrigatorioUid && !poolDoDia.some(([uid]) => uid === avaliadorObrigatorioUid)) continue;

      // Limite de segurança (2026-11-24) — nunca mais horários do que
      // trabalhos existem, pra garantir que o loop sempre termina mesmo
      // num caso adversarial não previsto.
      const horarioMaximo = params.trabalhos.length;
      for (let horario = 0; horario <= horarioMaximo; horario++) {
        const chaveSlot = `${dia}#${horario}`;
        const ocupados = ocupadosPorSlot.get(chaveSlot) ?? new Set<string>();
        if (ocupados.has(t.orientadorUid)) continue;
        if (avaliadorObrigatorioUid && ocupados.has(avaliadorObrigatorioUid)) continue;

        const candidatosDisponiveis = Array.from(diasPorUid.entries())
          .filter(
            ([uid, diasDisp]) =>
              uid !== t.orientadorUid &&
              diasDisp.has(dia) &&
              !ocupados.has(uid) &&
              uid !== avaliadorProibidoUid,
          )
          .map(([uid]) => uid)
          .sort((a, b) => (usosPorUid.get(a) ?? 0) - (usosPorUid.get(b) ?? 0));

        // Avaliador exigido entra primeiro na lista de escolhidos, se
        // estiver livre nesse horário — senão esse horário não serve
        // (a regra não é satisfeita), tenta o próximo.
        let candidatos = candidatosDisponiveis;
        if (avaliadorObrigatorioUid) {
          if (!candidatosDisponiveis.includes(avaliadorObrigatorioUid)) continue;
          candidatos = [
            avaliadorObrigatorioUid,
            ...candidatosDisponiveis.filter((uid) => uid !== avaliadorObrigatorioUid),
          ];
        }
        if (candidatos.length < 2) continue;
        const escolhidos = candidatos.slice(0, 2);

        // Prioridade de sala por avaliador (2026-11-27, pedido explícito do
        // usuário) — se o orientador (ou um dos 2 escolhidos) tem uma sala
        // preferida marcada em `salaPorUid`, tenta ESSA sala primeiro, só
        // caindo pra outra se ela já estiver ocupada/no teto nesse horário.
        // Sempre "tenta primeiro", nunca bloqueia a banca — por isso não
        // entra na lógica de overflow: o pior caso é a banca cair numa
        // sala diferente da preferida, nunca ficar sem banca por causa
        // disso.
        const salaPreferida = [t.orientadorUid, ...escolhidos]
          .map((uid) => salaPorUid.get(uid))
          .find((s): s is number => s != null && s >= 1 && s <= numeroSalas);
        const ordemSalas = salaPreferida
          ? [salaPreferida, ...Array.from({ length: numeroSalas }, (_, i) => i + 1).filter((s) => s !== salaPreferida)]
          : Array.from({ length: numeroSalas }, (_, i) => i + 1);

        const pessoasDaBanca = [t.orientadorUid, ...escolhidos];
        const salasUsadas = salasUsadasPorSlot.get(chaveSlot) ?? new Set<number>();
        for (const sala of ordemSalas) {
          if (salasUsadas.has(sala)) continue; // essa sala já tem banca nesse horário
          if (!salaComVagaNoDia(sala)) continue; // essa sala já bateu o teto do dia
          if (respeitarBufferSala && temConflitoDeBufferDeSala(dia, horario, sala, pessoasDaBanca)) continue;

          usosPorUid.set(t.orientadorUid, (usosPorUid.get(t.orientadorUid) ?? 0) + 1);
          for (const uid of escolhidos) usosPorUid.set(uid, (usosPorUid.get(uid) ?? 0) + 1);
          bancasPorSalaDia.set(`${dia}#${sala}`, (bancasPorSalaDia.get(`${dia}#${sala}`) ?? 0) + 1);
          salasUsadas.add(sala);
          salasUsadasPorSlot.set(chaveSlot, salasUsadas);
          const novoOcupados = new Set(ocupados);
          novoOcupados.add(t.orientadorUid);
          for (const uid of escolhidos) novoOcupados.add(uid);
          ocupadosPorSlot.set(chaveSlot, novoOcupados);
          for (const uid of pessoasDaBanca) salaDaPessoaPorSlot.set(`${dia}#${horario}#${uid}`, sala);

          bancasNovas.push({
            trabalhoId: t.id,
            data: dia,
            sala,
            horario,
            avaliadores: escolhidos.map((uid) => ({ uid, nome: nomePorUid.get(uid) ?? uid })),
          });
          return { ok: true };
        }
      }
    }

    const motivo = !orientadorTemAlgumDiaDisponivel
      ? "O orientador não marcou nenhum dia disponível dentro da janela do evento."
      : orientadorSoAchouDiasNoLimite
        ? "Todas as salas já bateram o máximo de bancas por dia configurado, nos dias em que o orientador está disponível."
        : avaliadorObrigatorioUid && avaliadorObrigatorioNuncaDisponivel
          ? "O avaliador priorizado pela regra não marcou nenhum dia disponível em comum com o orientador."
          : faltouAvaliadorEmDiaValido
            ? "Não há 2 avaliadores disponíveis nos dias em que o orientador pode participar."
            : "Não foi possível encontrar sala e horário sem conflito de pessoas nos dias disponíveis.";
    return { ok: false, motivo };
  }

  // Tenta primeiro respeitando o buffer de troca de sala (2026-11-27) e,
  // se não achar NADA assim, tenta de novo sem essa exigência — é
  // preferência, igual às outras regras: nunca deixa o trabalho sem banca
  // só por causa do buffer entre salas.
  function tentarComBufferDeSala(
    t: TrabalhoParaBanca,
    diasParaTentar: string[],
    avaliadorObrigatorioUid?: string,
    avaliadorProibidoUid?: string,
  ): { ok: true } | { ok: false; motivo: string } {
    const comBuffer = tentarAgendar(t, diasParaTentar, avaliadorObrigatorioUid, avaliadorProibidoUid, true);
    if (comBuffer.ok) return comBuffer;
    return tentarAgendar(t, diasParaTentar, avaliadorObrigatorioUid, avaliadorProibidoUid, false);
  }

  for (const t of trabalhosOrdenados) {
    const regra = regraPorTrabalho.get(t.id);
    let resultado: { ok: true } | { ok: false; motivo: string };

    if (regra?.restricao.tipo === "dia") {
      const diaRegra = regra.restricao.data;
      if (!diasValidos.has(diaRegra)) {
        resultado = {
          ok: false,
          motivo: `O dia priorizado pela regra de prioridade (${diaRegra}) está fora da janela de apresentações do evento.`,
        };
      } else {
        resultado = tentarComBufferDeSala(t, [diaRegra]);
        if (!resultado.ok) {
          resultado = {
            ok: false,
            motivo: `Não coube no dia priorizado pela regra de prioridade (${diaRegra}): ${resultado.motivo}`,
          };
        }
      }
    } else if (regra?.restricao.tipo === "avaliador") {
      resultado = tentarComBufferDeSala(t, params.dias, regra.restricao.uid);
      if (!resultado.ok) {
        resultado = {
          ok: false,
          motivo: `Não foi possível incluir o avaliador priorizado pela regra de prioridade (${regra.restricao.nome}) em nenhum dia/horário disponível.`,
        };
      }
    } else if (regra?.restricao.tipo === "evitar_dia") {
      const diaEvitado = regra.restricao.data;
      const diasPermitidos = params.dias.filter((d) => d !== diaEvitado);
      resultado = tentarComBufferDeSala(t, diasPermitidos);
      if (!resultado.ok) {
        resultado = {
          ok: false,
          motivo: `Não coube evitando o dia ${diaEvitado} (regra de prioridade): ${resultado.motivo}`,
        };
      }
    } else if (regra?.restricao.tipo === "evitar_avaliador") {
      resultado = tentarComBufferDeSala(t, params.dias, undefined, regra.restricao.uid);
      if (!resultado.ok) {
        resultado = {
          ok: false,
          motivo: `Não foi possível montar a banca evitando o avaliador priorizado pela regra de prioridade (${regra.restricao.nome}).`,
        };
      }
    } else {
      resultado = tentarComBufferDeSala(t, params.dias);
    }

    if (!resultado.ok) overflow.push({ trabalhoId: t.id, motivo: resultado.motivo });
  }

  return { bancasNovas, overflow };
}

// Mesmo limite/motivo de OPERACOES_POR_LOTE em sessoes.ts — 500 é o teto do
// Firestore por writeBatch, com folga.
const OPERACOES_POR_LOTE = 450;

/** Grava as bancas geradas, 2 escritas por trabalho (bancaData+
 * bancaAvaliadores+status num update só). Diferente de
 * substituirGradeDoEvento (sessoes.ts): não existe "sessão" pra apagar
 * aqui, cada trabalho já carrega a própria banca direto nos seus campos —
 * só atualiza os trabalhos que entraram em bancasNovas. Limpa
 * `motivoSemBanca` (2026-11-24) — se esse trabalho tinha ficado de fora
 * numa geração anterior, o motivo antigo não faz mais sentido agora que
 * ele conseguiu banca. */
export async function substituirBancaDoEvento(bancas: BancaGerada[]) {
  for (let i = 0; i < bancas.length; i += OPERACOES_POR_LOTE) {
    const batch = writeBatch(db);
    for (const b of bancas.slice(i, i + OPERACOES_POR_LOTE)) {
      batch.update(doc(db, "trabalhos", b.trabalhoId), {
        bancaData: b.data,
        bancaSala: b.sala,
        bancaHorarioIndex: b.horario,
        bancaAvaliadores: b.avaliadores,
        bancaAvaliadoresUids: b.avaliadores.map((a) => a.uid),
        status: "tcc_banca_agendada",
        motivoSemBanca: deleteField(),
        atualizadoEm: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

/** Grava o motivo de cada trabalho que NÃO coube em banca nenhuma
 * (2026-11-24, pedido explícito do usuário — a mensagem "X sem banca"
 * sumia ao atualizar a página, porque só existia em estado do React;
 * agora fica gravado no próprio trabalho, sobrevive a reload). Chamado
 * sempre junto de `substituirBancaDoEvento` na mesma geração — juntos,
 * os dois cobrem 100% de `params.trabalhos` passados pra
 * `montarBancaAutomatica` (todo trabalho com orientador sai de uma
 * geração ou com banca ou com motivo, nunca os dois nem nenhum). */
export async function salvarOverflowBanca(overflow: OverflowBanca[]) {
  for (let i = 0; i < overflow.length; i += OPERACOES_POR_LOTE) {
    const batch = writeBatch(db);
    for (const o of overflow.slice(i, i + OPERACOES_POR_LOTE)) {
      batch.update(doc(db, "trabalhos", o.trabalhoId), {
        motivoSemBanca: o.motivo,
        atualizadoEm: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

/** Envio em lote da Avaliação pra Resultado (2026-11-24, pedido explícito
 * do usuário — "não pode ter só o botão aprovar/reprovar direto, tem que
 * ter um 'enviar para resultado' igual na MAC, selecionando em lote só
 * quem já tem as 3 notas"). POR ALUNO (2026-11-27, ver `avaliacoesBanca`
 * em src/lib/data/trabalhos.ts) — numa dupla, cada aluno pode ser enviado
 * pra Resultado em momentos diferentes, independente do outro. A tela
 * (TrabalhosTCCView, trabalhos/page.tsx) só deixa selecionar quem já tem
 * `avaliacao.notas.length === 3` — essa função confia nisso e só grava o
 * `statusFinal`, não revalida. Agrupa por trabalho (2+ alunos selecionados
 * do MESMO trabalho viram 1 update só, não 2). */
export async function enviarParaResultadoTCC(
  selecoes: { trabalho: Trabalho; alunoUid: string }[],
) {
  const porTrabalho = new Map<string, { trabalho: Trabalho; alunoUids: Set<string> }>();
  for (const s of selecoes) {
    const atual = porTrabalho.get(s.trabalho.id) ?? { trabalho: s.trabalho, alunoUids: new Set<string>() };
    atual.alunoUids.add(s.alunoUid);
    porTrabalho.set(s.trabalho.id, atual);
  }
  const entradas = [...porTrabalho.values()];
  for (let i = 0; i < entradas.length; i += OPERACOES_POR_LOTE) {
    const batch = writeBatch(db);
    for (const { trabalho, alunoUids } of entradas.slice(i, i + OPERACOES_POR_LOTE)) {
      const avaliacoesBanca = (trabalho.avaliacoesBanca ?? []).map((a) =>
        alunoUids.has(a.alunoUid) ? { ...a, statusFinal: "tcc_avaliado" as const } : a,
      );
      batch.update(doc(db, "trabalhos", trabalho.id), {
        avaliacoesBanca,
        atualizadoEm: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

/** Ajuste manual pós-geração (2026-11-16, mesmo espírito de moverTrabalho em
 * sessoes.ts) — admin troca o dia e/ou os 2 avaliadores de UM trabalho sem
 * precisar gerar a banca inteira de novo. Não valida capacidade (é uma
 * escolha manual, deliberadamente por cima do algoritmo automático). Limpa
 * `bancaSala`/`bancaHorarioIndex` (2026-11-24) — o ajuste manual não passa
 * pelo checker de conflito de horário entre salas, então esses campos
 * ficariam mentindo sobre uma sala/horário que ninguém verificou; a banca
 * continua marcada (por dia), só sai da grade "Horário × Sala" até alguém
 * rodar a geração de novo ou arrumar isso na mão. */
export function moverBanca(
  trabalhoId: string,
  data: string,
  avaliadores: { uid: string; nome: string }[],
) {
  return updateDoc(doc(db, "trabalhos", trabalhoId), {
    bancaData: data,
    bancaSala: deleteField(),
    bancaHorarioIndex: deleteField(),
    bancaAvaliadores: avaliadores,
    bancaAvaliadoresUids: avaliadores.map((a) => a.uid),
    status: "tcc_banca_agendada",
    atualizadoEm: serverTimestamp(),
  });
}

/** Lança a nota de UM membro da banca PRA UM ALUNO específico da dupla
 * (2026-11-16, estendido 2026-11-27 pra separar por aluno — "em TCCs em
 * duplas precisa ser avaliado ambos os alunos") — nunca sobrescreve a nota
 * dos outros 2 membros da banca, nem a de outro aluno da mesma dupla
 * (substitui só a entrada com o mesmo uid DENTRO da entrada do mesmo
 * aluno). Calcula a nota final (média) desse aluno assim que a 3ª nota
 * dele chega; antes disso o campo fica ausente. Cria a entrada do aluno em
 * `avaliacoesBanca` na primeira nota, se ainda não existir. firestore.rules
 * restringe quem chama isso a só mexer em avaliacoesBanca/atualizadoEm (ver
 * regra de update em /trabalhos — orientadorUid ou bancaAvaliadoresUids
 * bater com quem está logado). */
export async function salvarNotaBanca(params: {
  trabalhoId: string;
  avaliacoesAtuais: AvaliacaoBancaAluno[];
  alunoUid: string;
  alunoNome: string;
  minhaNota: NotaBancaTCC;
}) {
  const indice = params.avaliacoesAtuais.findIndex((a) => a.alunoUid === params.alunoUid);
  const avaliacaoAtual: AvaliacaoBancaAluno =
    indice >= 0
      ? params.avaliacoesAtuais[indice]
      : { alunoUid: params.alunoUid, alunoNome: params.alunoNome, notas: [] };

  const notas = [
    ...avaliacaoAtual.notas.filter((n) => n.uid !== params.minhaNota.uid),
    params.minhaNota,
  ];
  const notaFinal =
    notas.length === 3 ? notas.reduce((acc, n) => acc + n.nota, 0) / 3 : undefined;
  const novaAvaliacao: AvaliacaoBancaAluno = {
    ...avaliacaoAtual,
    notas,
    ...(notaFinal != null ? { notaFinal } : {}),
  };

  const avaliacoesBanca =
    indice >= 0
      ? params.avaliacoesAtuais.map((a, i) => (i === indice ? novaAvaliacao : a))
      : [...params.avaliacoesAtuais, novaAvaliacao];

  await updateDoc(doc(db, "trabalhos", params.trabalhoId), {
    avaliacoesBanca,
    atualizadoEm: serverTimestamp(),
  });
}
