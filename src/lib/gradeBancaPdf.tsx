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

// Mesma paleta/estilo de gradeEnsalamentoPdf.tsx (ensalamento da MAC) — só
// adaptado pra agrupar por SALA sem dia (2026-11-24, pedido explícito do
// usuário: "pode ser um pdf depois para enviarmos para os alunos e uma
// lista por sala não separado por dias").
const cores = {
  navy900: "#0a2c47",
  navy800: "#0e3a5e",
  ink: "#142433",
  muted: "#5b6b78",
  linhaClara: "#e3e9ee",
  faixaClara: "#f4f7f9",
  chip: "#eef3f7",
};

const estilos = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    paddingTop: 70,
    paddingHorizontal: 32,
    paddingBottom: 46,
    backgroundColor: "#ffffff",
  },
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
  headerCentro: { alignItems: "center", flex: 1 },
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
  salaInfoFaixa: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    backgroundColor: cores.chip,
    paddingVertical: 9,
    paddingHorizontal: 12,
    gap: 24,
  },
  // Dia e quantidade de bancas aumentados (2026-11-24, pedido explícito do
  // usuário — "aumente o dia e a quantidade de bancas") — viram o destaque
  // da faixa, não um detalhe pequeno igual antes.
  salaInfoItem: { fontSize: 12, color: cores.ink },
  salaInfoValor: { fontFamily: "Helvetica-Bold", color: cores.navy900, fontSize: 13 },
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
  colHorario: { width: 80 },
  colTrabalho: { flex: 1 },
  // Mais espaço entre trabalhos (2026-11-24, pedido explícito do usuário —
  // "dar mais espaço entre os trabalhos") — paddingVertical quase dobrado
  // (7 → 13) e cada linha do bloco com seu próprio espaçamento (gap),
  // já que agora são até 5 linhas de texto por trabalho (aluno, título,
  // orientador, 2 avaliadores), não mais 2.
  linha: {
    flexDirection: "row",
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: cores.linhaClara,
  },
  linhaZebra: { backgroundColor: cores.faixaClara },
  tdHorario: { fontSize: 9, fontFamily: "Helvetica-Bold", color: cores.ink, marginTop: 1 },
  // Aluno(a) em linha própria, em destaque — título embaixo, depois
  // orientador/avaliadores cada um na sua linha (2026-11-24, pedido
  // explícito do usuário — "coloque nome do aluno na linha de baixo nome
  // do trabalho e embaixo o orientador e avaliador").
  blocoTrabalho: { gap: 3 },
  tdAluno: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: cores.navy900 },
  tdTitulo: { fontSize: 9.5, color: cores.ink, lineHeight: 1.3 },
  tdSubinfo: { fontSize: 8.5, color: cores.muted },
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

// Encolhe a linha (padding/gap/fonte) conforme o número de bancas daquele
// dia+sala, pra caber tudo numa página só (2026-11-24, pedido explícito do
// usuário — "tem que ser a sala em uma página"; com o espaçamento fixo
// anterior, 8 bancas já estourava pra uma 2ª página). Calibrado pra caber
// confortavelmente até ~8-10 bancas no tamanho normal; acima disso encolhe
// até um piso de 60% (menor que isso fica difícil de ler impresso) — nesse
// caso extremo ainda pode sobrar 1-2 linhas pra página seguinte, mas isso é
// raro (a maioria dos dias não passa de ~8 bancas por sala, dado o tempo
// físico de uma sessão). Números abaixo vêm de medir a altura real de uma
// linha no tamanho base (padding 13 + ~5 linhas de texto ≈ 92pt) contra a
// altura disponível numa página A4 depois do cabeçalho/rodapé/faixas da
// sala (≈ 600pt, com folga).
function escalaPara(quantidade: number): number {
  const ALTURA_LINHA_BASE = 92;
  const ALTURA_DISPONIVEL = 600;
  const bruta = ALTURA_DISPONIVEL / (ALTURA_LINHA_BASE * Math.max(quantidade, 1));
  return Math.max(0.6, Math.min(1, bruta));
}

export type ItemBancaParaPdf = {
  horario: string; // já formatado, ex. "19h00–19h20" ou "Horário 1"
  alunoNome: string;
  titulo: string;
  nomeOrientador: string;
  // Separados (2026-11-24, pedido explícito do usuário — "coloque os
  // avaliadores como avaliador 1: aaaaa avaliador 2: bbbbbbb"), não mais
  // uma string só já junta com vírgula.
  avaliador1: string;
  avaliador2: string;
};

// 1 grupo = 1 sala + 1 dia = 1 página inteira (2026-11-24, pedido explícito
// do usuário — "pode ser por sala e dia, cada folha uma sala e dia").
export type GrupoBancaParaPdf = {
  salaNome: string;
  diaLabel: string; // já formatado, ex. "segunda-feira, 30/11"
  itens: ItemBancaParaPdf[];
};

/** PDF da banca de TCC, uma PÁGINA por sala+dia (2026-11-24, pedido
 * explícito do usuário — primeiro só "agrupado por sala", depois "pode ser
 * por sala e dia, cada folha uma sala e dia") — pra postar nos grupos, cada
 * turma/sala/dia vira uma folha própria, fácil de imprimir/recortar
 * separado. Mesmo espírito visual de GradeEnsalamentoPDF/MAC, sem
 * modalidade/moderador, que não existem em TCC. */
export function GradeBancaPDF({
  eventoNome,
  geradoEm,
  grupos,
}: {
  eventoNome: string;
  geradoEm: string;
  grupos: GrupoBancaParaPdf[];
}) {
  return (
    <Document>
      {grupos.map((g, idx) => {
        // Escala calculada por grupo (2026-11-24) — uma sala com 4 bancas
        // num dia usa o tamanho normal; uma com 10 no mesmo dia encolhe um
        // pouco, mas as duas cabem na própria página sozinhas.
        const escala = escalaPara(g.itens.length);
        const estiloLinhaEscalado = { paddingVertical: 13 * escala };
        const estiloBlocoEscalado = { gap: 3 * escala };
        const estiloAlunoEscalado = { fontSize: 10.5 * escala };
        const estiloTituloEscalado = { fontSize: 9.5 * escala };
        const estiloSubinfoEscalado = { fontSize: 8.5 * escala };

        return (
          <Page key={`${g.salaNome}-${g.diaLabel}-${idx}`} size="A4" style={estilos.page} wrap>
            <View style={estilos.cabecalho} fixed>
              <Image src={LOGO_FATEC} style={estilos.logo} />
              <View style={estilos.headerCentro}>
                <Text style={estilos.headerTitulo}>BANCA DE TCC</Text>
                <Text style={estilos.headerSubtitulo}>{eventoNome}</Text>
              </View>
            </View>

            <View style={estilos.salaBloco}>
              <View style={estilos.salaFaixa}>
                <Text style={estilos.salaNome}>Sala - {g.salaNome}</Text>
              </View>
              <View style={estilos.salaInfoFaixa}>
                <Text style={estilos.salaInfoItem}>
                  <Text style={estilos.salaInfoLabel}>Dia: </Text>
                  <Text style={estilos.salaInfoValor}>{g.diaLabel}</Text>
                </Text>
                <Text style={estilos.salaInfoItem}>
                  <Text style={estilos.salaInfoLabel}>Bancas: </Text>
                  <Text style={estilos.salaInfoValor}>{g.itens.length}</Text>
                </Text>
              </View>

              <View style={estilos.tabelaCabecalho}>
                <Text style={[estilos.thTexto, estilos.colHorario]}>HORÁRIO</Text>
                <Text style={[estilos.thTexto, estilos.colTrabalho]}>ALUNO(A) / TRABALHO</Text>
              </View>
              {g.itens.map((item, i) => (
                <View
                  key={i}
                  style={[
                    estilos.linha,
                    ...(i % 2 === 1 ? [estilos.linhaZebra] : []),
                    estiloLinhaEscalado,
                  ]}
                >
                  <Text style={[estilos.tdHorario, estilos.colHorario]}>{item.horario}</Text>
                  <View style={[estilos.colTrabalho, estilos.blocoTrabalho, estiloBlocoEscalado]}>
                    <Text style={[estilos.tdAluno, estiloAlunoEscalado]}>{item.alunoNome}</Text>
                    <Text style={[estilos.tdTitulo, estiloTituloEscalado]}>{item.titulo}</Text>
                    <Text style={[estilos.tdSubinfo, estiloSubinfoEscalado]}>
                      <Text style={estilos.tdSubinfoLabel}>Orientador(a): </Text>
                      {item.nomeOrientador || "—"}
                    </Text>
                    <Text style={[estilos.tdSubinfo, estiloSubinfoEscalado]}>
                      <Text style={estilos.tdSubinfoLabel}>Avaliador 1: </Text>
                      {item.avaliador1 || "—"}
                    </Text>
                    <Text style={[estilos.tdSubinfo, estiloSubinfoEscalado]}>
                      <Text style={estilos.tdSubinfoLabel}>Avaliador 2: </Text>
                      {item.avaliador2 || "—"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={estilos.rodape} fixed>
              <Text>Gerado em {geradoEm} · SIGMA — Fatec Ivaiporã</Text>
              <Text
                render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
              />
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
