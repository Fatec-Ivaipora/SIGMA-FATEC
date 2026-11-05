import fs from "node:fs";
import path from "node:path";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

// Mesmo truque do resto dos PDFs do sistema (ver certificadosPdf.tsx) —
// react-pdf tenta usar fetch() mesmo pra caminho local e falha em file://
// no Windows/Node, por isso o buffer já lido na mão.
const LOGO_FATEC = {
  data: fs.readFileSync(path.join(process.cwd(), "public", "certificados", "logo-fatec-ivp.png")),
  format: "png" as const,
};
const LOGO_MAC = {
  data: fs.readFileSync(path.join(process.cwd(), "public", "certificados", "logo-mac.png")),
  format: "png" as const,
};

// Paleta da marca (2026-11-05, redesenho pedido explícito do usuário —
// "deixe profissional nível acadêmico") — mesmas cores do design system web
// (ver DESIGN.md: navy estrutural, orange/sky como acento), só que aqui só
// orange/sky marcam a modalidade (oral/roda de conversa) pra escanear
// rápido qual sala é qual.
const cores = {
  navy900: "#0a2c47",
  navy800: "#0e3a5e",
  ink: "#142433",
  muted: "#5b6b78",
  orange: "#d9480f",
  sky: "#1f6391",
  linhaClara: "#e3e9ee",
  faixaClara: "#f4f7f9",
  chip: "#eef3f7",
};

const COR_MODALIDADE: Record<"oral" | "roda_conversa", string> = {
  oral: cores.orange,
  roda_conversa: cores.sky,
};

const LABEL_MODALIDADE: Record<"oral" | "roda_conversa", string> = {
  oral: "Apresentação Oral",
  roda_conversa: "Roda de Conversa",
};

const estilos = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    paddingTop: 70,
    paddingHorizontal: 32,
    paddingBottom: 46,
    backgroundColor: "#ffffff",
  },
  // Cabeçalho com as duas logos fixo em toda página (2026-11-05, pedido
  // explícito do usuário — logo da Fatec + logo da MAC no topo de todas as
  // páginas). `position: absolute` + paddingTop na página é o que evita
  // sobrepor o conteúdo.
  cabecalho: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: cores.navy800,
    paddingTop: 16,
    paddingBottom: 10,
    paddingHorizontal: 32,
  },
  logo: { height: 38 },
  headerCentro: { alignItems: "center" },
  headerTitulo: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: cores.navy900,
    letterSpacing: 1.5,
  },
  headerSubtitulo: {
    fontSize: 9,
    color: cores.muted,
    marginTop: 2,
  },
  // Bloco de 1 sala — cartão com faixa de título escura + faixa de
  // informação + tabela (2026-11-05, redesenho). wrap={false} no <View>
  // raiz do bloco: a sala inteira pula pra próxima página se não couber
  // inteira na que está, nunca corta no meio.
  salaBloco: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: cores.linhaClara,
  },
  salaFaixa: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: cores.navy900,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  salaNome: {
    fontSize: 12.5,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  salaModalidadeChip: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 9,
  },
  salaInfoFaixa: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: cores.chip,
    paddingVertical: 5,
    paddingHorizontal: 12,
    gap: 18,
  },
  salaInfoItem: { fontSize: 8.5, color: cores.ink },
  salaInfoLabel: { fontFamily: "Helvetica-Bold", color: cores.navy800 },
  tabelaCabecalho: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: cores.linhaClara,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  thTexto: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: cores.muted,
    letterSpacing: 0.5,
  },
  // Só 2 colunas (2026-11-05, achado real do usuário — "ficou muito junto
  // os autores com o nome do título, eles se misturam, e a quebra
  // automática do título tá horrível"): o layout de 4 colunas lado a lado
  // espremia o título numa coluna estreita, quebrando em várias linhas
  // coladas no autor do lado. Agora o título tem a largura inteira da
  // coluna (quebra limpo, sem vizinho do lado) e autor/área ficam numa
  // linha separada EMBAIXO, com respiro (marginTop), nunca de lado.
  colHorario: { width: 50 },
  colTrabalho: { flex: 1 },
  linha: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: cores.linhaClara,
  },
  linhaZebra: { backgroundColor: cores.faixaClara },
  tdHorario: { fontSize: 9, fontFamily: "Helvetica-Bold", color: cores.ink, marginTop: 1 },
  tdTitulo: { fontSize: 9.5, color: cores.ink, lineHeight: 1.3 },
  tdSubinfo: { fontSize: 8, color: cores.muted, marginTop: 3 },
  tdSubinfoLabel: { fontFamily: "Helvetica-Bold", color: cores.navy800 },
  rodape: {
    position: "absolute",
    bottom: 18,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    fontSize: 7.5,
    color: cores.muted,
  },
});

export type SalaParaPdf = {
  salaNome: string;
  moderadorNome?: string;
  modalidade: "oral" | "roda_conversa";
  horarioInicio: string;
  horarioFim: string;
  itens: { titulo: string; horario?: string; autores: string; area: string }[];
};

/** PDF do ensalamento — pra postar nos grupos, aluno achar a própria sala
 * (2026-11-05, pedido explícito do usuário, redesenhado na mesma data —
 * "deixe mais bonito, profissional nível acadêmico"). 1 cartão por sala
 * (faixa escura com nome + modalidade, faixa clara com moderador/horário,
 * tabela com cabeçalho de colunas e zebra) — mesmo agrupamento da tela
 * /ensalamento, só que todo mundo exposto de uma vez (não escondido num
 * modal por sala, que não faz sentido num PDF pra distribuir). */
export function GradeEnsalamentoPDF({
  eventoNome,
  geradoEm,
  salas,
}: {
  eventoNome: string;
  geradoEm: string;
  salas: SalaParaPdf[];
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={estilos.page} wrap>
        <View style={estilos.cabecalho} fixed>
          <Image src={LOGO_FATEC} style={estilos.logo} />
          <View style={estilos.headerCentro}>
            <Text style={estilos.headerTitulo}>ENSALAMENTO</Text>
            <Text style={estilos.headerSubtitulo}>{eventoNome}</Text>
          </View>
          <Image src={LOGO_MAC} style={estilos.logo} />
        </View>

        {salas.map((s) => (
          <View key={s.salaNome} style={estilos.salaBloco} wrap={false}>
            <View style={estilos.salaFaixa}>
              <Text style={estilos.salaNome}>Sala - {s.salaNome}</Text>
              <Text
                style={[
                  estilos.salaModalidadeChip,
                  { backgroundColor: COR_MODALIDADE[s.modalidade] },
                ]}
              >
                {LABEL_MODALIDADE[s.modalidade]}
              </Text>
            </View>
            <View style={estilos.salaInfoFaixa}>
              <Text style={estilos.salaInfoItem}>
                <Text style={estilos.salaInfoLabel}>Moderador: </Text>
                {s.moderadorNome ?? "A DEFINIR"}
              </Text>
              <Text style={estilos.salaInfoItem}>
                <Text style={estilos.salaInfoLabel}>Horário: </Text>
                {s.horarioInicio} – {s.horarioFim}
              </Text>
              <Text style={estilos.salaInfoItem}>
                <Text style={estilos.salaInfoLabel}>Trabalhos: </Text>
                {s.itens.length}
              </Text>
            </View>

            <View style={estilos.tabelaCabecalho}>
              <Text style={[estilos.thTexto, estilos.colHorario]}>HORÁRIO</Text>
              <Text style={[estilos.thTexto, estilos.colTrabalho]}>TRABALHO</Text>
            </View>
            {s.itens.map((item, i) => (
              <View
                key={i}
                style={i % 2 === 1 ? [estilos.linha, estilos.linhaZebra] : estilos.linha}
              >
                <Text style={[estilos.tdHorario, estilos.colHorario]}>{item.horario ?? "—"}</Text>
                <View style={estilos.colTrabalho}>
                  <Text style={estilos.tdTitulo}>{item.titulo}</Text>
                  <Text style={estilos.tdSubinfo}>
                    <Text style={estilos.tdSubinfoLabel}>Autor(es): </Text>
                    {item.autores || "—"}
                    <Text style={estilos.tdSubinfoLabel}>{"   ·   Área: "}</Text>
                    {item.area || "—"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        <View style={estilos.rodape} fixed>
          <Text>Gerado em {geradoEm} · SIGMA — Fatec Ivaiporã</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
