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

const cores = {
  navy900: "#0a2c47",
  navy800: "#0e3a5e",
  ink: "#142433",
  muted: "#5b6b78",
  linhaClara: "#e3e9ee",
  faixaClara: "#f4f7f9",
};

const estilos = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    paddingTop: 70,
    paddingHorizontal: 40,
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
    paddingHorizontal: 40,
  },
  logo: { height: 38 },
  headerCentro: { alignItems: "center", flex: 1 },
  headerTitulo: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: cores.navy900,
    letterSpacing: 1,
  },
  // Nome do evento em cima, cargo embaixo (2026-11-25, pedido explícito do
  // usuário — "relatório pra anexar caso o MEC peça isso").
  tituloEvento: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: cores.navy900,
    textAlign: "center",
    marginBottom: 4,
  },
  cargo: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: cores.navy800,
    textAlign: "center",
    marginBottom: 20,
  },
  linha: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: cores.linhaClara,
  },
  linhaZebra: { backgroundColor: cores.faixaClara },
  colNumero: { width: 36, fontSize: 10, fontFamily: "Helvetica-Bold", color: cores.muted },
  colNome: { flex: 1, fontSize: 11, color: cores.ink },
  rodape: {
    position: "absolute",
    bottom: 18,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 40,
    fontSize: 7.5,
    color: cores.muted,
  },
});

/** Relatório de pessoas por cargo, pra anexar em prestação de contas ao MEC
 * (2026-11-25, pedido explícito do usuário) — nome do evento em cima, cargo
 * embaixo, depois só uma sequência numerada com o nome de cada pessoa. Sem
 * e-mail/uid/outra informação — só número + nome, como pedido. */
export function RelatorioCargoPDF({
  eventoNome,
  cargoLabel,
  geradoEm,
  nomes,
}: {
  eventoNome: string;
  cargoLabel: string;
  geradoEm: string;
  nomes: string[];
}) {
  return (
    <Document>
      <Page size="A4" style={estilos.page} wrap>
        <View style={estilos.cabecalho} fixed>
          <Image src={LOGO_FATEC} style={estilos.logo} />
          <View style={estilos.headerCentro}>
            <Text style={estilos.headerTitulo}>RELATÓRIO DE PARTICIPAÇÃO</Text>
          </View>
        </View>

        <Text style={estilos.tituloEvento}>{eventoNome}</Text>
        <Text style={estilos.cargo}>{cargoLabel}</Text>

        {nomes.length === 0 ? (
          <Text style={{ fontSize: 11, color: cores.muted, textAlign: "center" }}>
            Nenhuma pessoa registrada nesse cargo pra esse evento.
          </Text>
        ) : (
          nomes.map((nome, i) => (
            <View key={`${i}-${nome}`} style={i % 2 === 1 ? [estilos.linha, estilos.linhaZebra] : estilos.linha}>
              <Text style={estilos.colNumero}>{i + 1}.</Text>
              <Text style={estilos.colNome}>{nome}</Text>
            </View>
          ))
        )}

        <View style={estilos.rodape} fixed>
          <Text>Gerado em {geradoEm} · SIGMA — Fatec Ivaiporã</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
