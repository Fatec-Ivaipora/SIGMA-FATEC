import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

/** Etiquetas das pastas da MAC (2026-11-04, pedido explícito do usuário — a
 * secretaria identifica a pasta de cada trabalho pelo autor principal). No
 * formato da folha de etiquetas adesivas que a secretaria já usa ("ETIQUETAS
 * EM BRANCO.doc"): Carta, 2 colunas × 10 linhas = 20 por folha, etiqueta de
 * 2,54 × 10,16 cm (padrão Pimaco 6181: margem de cima/baixo 1,27 cm, laterais
 * 0,4 cm, 0,48 cm entre as colunas). Sem borda — a folha já vem recortada.
 * Em cada uma: NOME DO AUTOR PRINCIPAL (centralizado, como no modelo), título
 * (até 2 linhas) e área temática. */
export type EtiquetaPasta = {
  autor: string;
  titulo: string;
  area: string;
};

const CM = 28.3465;
const ETIQUETA_LARGURA = 10.16 * CM;
const ETIQUETA_ALTURA = 2.54 * CM;
const MARGEM_TOPO = 1.27 * CM;
const MARGEM_LADO = 0.4 * CM;
const ENTRE_COLUNAS = 0.48 * CM;
const POR_FOLHA = 20;

const estilo = StyleSheet.create({
  pagina: {
    fontFamily: "Helvetica",
    paddingTop: MARGEM_TOPO,
    paddingLeft: MARGEM_LADO,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  etiqueta: {
    width: ETIQUETA_LARGURA,
    height: ETIQUETA_ALTURA,
    paddingHorizontal: 10,
    paddingVertical: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  autor: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#0e3a5e",
    textAlign: "center",
    maxLines: 1,
    textOverflow: "ellipsis",
  },
  titulo: {
    fontSize: 7,
    color: "#142433",
    textAlign: "center",
    lineHeight: 1.2,
    marginTop: 2,
    maxLines: 2,
    textOverflow: "ellipsis",
  },
  area: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: "#5b6b78",
    textAlign: "center",
    marginTop: 2,
    maxLines: 1,
    textOverflow: "ellipsis",
  },
});

export function EtiquetasPastasPDF({ etiquetas }: { eventoNome?: string; etiquetas: EtiquetaPasta[] }) {
  const paginas: EtiquetaPasta[][] = [];
  for (let i = 0; i < etiquetas.length; i += POR_FOLHA) paginas.push(etiquetas.slice(i, i + POR_FOLHA));
  return (
    <Document>
      {paginas.map((pagina, p) => (
        <Page key={p} size="LETTER" style={estilo.pagina}>
          {pagina.map((e, i) => (
            <View
              key={i}
              style={[estilo.etiqueta, { marginRight: i % 2 === 0 ? ENTRE_COLUNAS : 0 }]}
              wrap={false}
            >
              <Text style={estilo.autor}>{e.autor.toUpperCase()}</Text>
              <Text style={estilo.titulo}>{e.titulo.toUpperCase()}</Text>
              <Text style={estilo.area}>{e.area}</Text>
            </View>
          ))}
        </Page>
      ))}
    </Document>
  );
}
