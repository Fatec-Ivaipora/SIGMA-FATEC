import path from "node:path";
import fs from "node:fs";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function formatarDataExtenso(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${ano}`;
}

export function formatarDataNumerica(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Lista humana com "e" antes do último item: ["A","B","C"] -> "A, B e C". */
export function juntarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

// react-pdf tenta usar fetch() mesmo pra caminho local (e falha em file://
// no Windows/Node) — passar o buffer já lido evita isso por completo.
const FUNDO_APRESENTACAO = {
  data: fs.readFileSync(
    path.join(process.cwd(), "public", "certificados", "fundo-apresentacao.png"),
  ),
  format: "png" as const,
};

const cores = {
  navy900: "#0a2c47",
  navy800: "#0e3a5e",
  ink: "#142433",
  muted: "#5b6b78",
};

const estiloApresentacao = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    position: "relative",
    // Sem altura fixa, o React-PDF encolhe a página pro tamanho do conteúdo
    // em vez de manter o A4 paisagem inteiro (841.89 x 595.28pt) — cortava o
    // fundo. Trava explicitamente aqui.
    width: 841.89,
    height: 595.28,
  },
  fundo: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  // Fluxo normal (não position:absolute) — evita um bug do React-PDF onde um
  // bloco absoluto dentro da Page é medido errado e o texto inteiro
  // transborda pra uma segunda página em branco, deixando o fundo sozinho
  // na primeira.
  conteudo: {
    paddingTop: 130,
    paddingHorizontal: 80,
    alignItems: "center",
  },
  rotulo: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: cores.navy900,
    marginBottom: 22,
  },
  nomes: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: cores.navy900,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 1.4,
  },
  corpo: {
    fontSize: 12,
    color: cores.ink,
    textAlign: "center",
    lineHeight: 1.6,
    marginBottom: 30,
  },
  negrito: {
    fontFamily: "Helvetica-Bold",
  },
  data: {
    fontSize: 12,
    color: cores.ink,
    marginBottom: 46,
  },
  assinaturas: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 80,
  },
  assinatura: {
    alignItems: "center",
    width: 220,
  },
  linhaAssinatura: {
    borderTopWidth: 1,
    borderTopColor: cores.ink,
    width: "100%",
    marginBottom: 6,
  },
  nomeAssinatura: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: cores.ink,
  },
  cargoAssinatura: {
    fontSize: 10,
    color: cores.muted,
  },
  registro: {
    position: "absolute",
    bottom: 40,
    right: 90,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: cores.navy800,
  },
});

export function CertificadoApresentacaoPDF({
  nomes,
  eventoNome,
  dataRealizacao,
  tituloTrabalho,
  registroNumero,
  diretorNome,
  presidenteNome,
}: {
  nomes: string[];
  eventoNome: string;
  dataRealizacao: string;
  tituloTrabalho: string;
  registroNumero: number;
  diretorNome: string;
  presidenteNome: string;
}) {
  const plural = nomes.length > 1;
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={estiloApresentacao.page}>
        <Image fixed src={FUNDO_APRESENTACAO} style={estiloApresentacao.fundo} />
        <View style={estiloApresentacao.conteudo}>
          <Text style={estiloApresentacao.rotulo}>Certificamos que</Text>
          <Text style={estiloApresentacao.nomes}>{juntarNomes(nomes)}</Text>
          <Text style={estiloApresentacao.corpo}>
            {plural ? "participaram" : "participou"} da{" "}
            <Text style={estiloApresentacao.negrito}>{eventoNome}</Text>, promovida
            pela FATEC - Faculdade de Tecnologia do Vale do Ivaí, realizada no
            dia {formatarDataExtenso(dataRealizacao)}, em Ivaiporã – PR,
            apresentando o trabalho intitulado{"\n"}“
            <Text style={estiloApresentacao.negrito}>{tituloTrabalho}</Text>”.
          </Text>
          <Text style={estiloApresentacao.data}>
            Ivaiporã, {formatarDataExtenso(dataRealizacao)}.
          </Text>
          <View style={estiloApresentacao.assinaturas}>
            <View style={estiloApresentacao.assinatura}>
              <View style={estiloApresentacao.linhaAssinatura} />
              <Text style={estiloApresentacao.nomeAssinatura}>
                {diretorNome.toUpperCase()}
              </Text>
              <Text style={estiloApresentacao.cargoAssinatura}>
                Diretor Acadêmico
              </Text>
            </View>
            <View style={estiloApresentacao.assinatura}>
              <View style={estiloApresentacao.linhaAssinatura} />
              <Text style={estiloApresentacao.nomeAssinatura}>
                {presidenteNome.toUpperCase()}
              </Text>
              <Text style={estiloApresentacao.cargoAssinatura}>
                Presidente da Comissão Organizadora
              </Text>
            </View>
          </View>
        </View>
        <Text fixed style={estiloApresentacao.registro}>
          REGISTRO SOB O N° {registroNumero}, LIVRO N° 01
        </Text>
      </Page>
    </Document>
  );
}

const PAPEL_TEXTO: Record<"avaliador" | "moderador" | "orientador" | "monitor", string> = {
  avaliador: "avaliador(a) dos trabalhos",
  moderador: "moderador(a) dos trabalhos",
  orientador: "orientador(a) de projeto",
  monitor: "monitor(a) de apoio ao evento",
};

const estiloDeclaracao = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    paddingTop: 50,
    paddingHorizontal: 55,
    paddingBottom: 40,
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 2,
    borderBottomColor: cores.navy800,
    paddingBottom: 12,
    marginBottom: 60,
  },
  marcaFatec: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: cores.navy800,
  },
  marcaIvp: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#2376b9",
    letterSpacing: 1,
  },
  textoCredenciamento: {
    flex: 1,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: cores.navy800,
    lineHeight: 1.5,
  },
  titulo: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    textDecoration: "underline",
    color: cores.ink,
    marginBottom: 40,
  },
  corpo: {
    fontSize: 12,
    color: cores.ink,
    lineHeight: 1.8,
    marginBottom: 40,
  },
  negrito: {
    fontFamily: "Helvetica-Bold",
  },
  fechamento: {
    fontSize: 12,
    color: cores.ink,
    textAlign: "center",
    marginBottom: 90,
  },
  data: {
    fontSize: 12,
    color: cores.ink,
    textAlign: "center",
    marginBottom: 46,
  },
  assinatura: {
    alignItems: "center",
    alignSelf: "center",
    width: 260,
  },
  linhaAssinatura: {
    borderTopWidth: 1,
    borderTopColor: cores.ink,
    width: "100%",
    marginBottom: 6,
  },
  nomeAssinatura: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: cores.ink,
  },
  cargoAssinatura: {
    fontSize: 10,
    color: cores.muted,
  },
  rodape: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: cores.navy800,
  },
});

export function DeclaracaoPDF({
  nome,
  papel,
  eventoNome,
  dataRealizacao,
  cargaHoraria,
  diretorNome,
  dataAssinatura,
}: {
  nome: string;
  papel: "avaliador" | "moderador" | "orientador" | "monitor";
  eventoNome: string;
  dataRealizacao: string;
  cargaHoraria: number;
  diretorNome: string;
  dataAssinatura: string;
}) {
  return (
    <Document>
      <Page size="A4" wrap={false} style={estiloDeclaracao.page}>
        <View style={estiloDeclaracao.cabecalho}>
          <View>
            <Text style={estiloDeclaracao.marcaFatec}>FATEC</Text>
            <Text style={estiloDeclaracao.marcaIvp}>IVP</Text>
          </View>
          <Text style={estiloDeclaracao.textoCredenciamento}>
            Mantida pela União de Ensino Superior do Vale do Ivaí Ltda -
            UNESVI{"\n"}
            Credenciamento EaD - Portaria n° 874 de 28 de novembro de 2025
            {"\n"}
            Recredenciamento - Portaria n° 878 de 28 de novembro de 2025
          </Text>
        </View>

        <Text style={estiloDeclaracao.titulo}>DECLARAÇÃO</Text>

        <Text style={estiloDeclaracao.corpo}>
          Declaramos para os devidos fins que{" "}
          <Text style={estiloDeclaracao.negrito}>{nome}</Text>, participou na
          qualidade de{" "}
          <Text style={estiloDeclaracao.negrito}>{PAPEL_TEXTO[papel]}</Text>{" "}
          na <Text style={estiloDeclaracao.negrito}>{eventoNome}</Text>, da
          Faculdade de Tecnologia do Vale do Ivaí – FATEC. O evento foi
          realizado em {formatarDataNumerica(dataRealizacao)}, com carga
          horária de {String(cargaHoraria).padStart(2, "0")} horas.
        </Text>

        <Text style={estiloDeclaracao.fechamento}>
          Por ser expressão da verdade, firmamos a presente.
        </Text>

        <Text style={estiloDeclaracao.data}>
          Ivaiporã, {formatarDataExtenso(dataAssinatura)}
        </Text>

        <View style={estiloDeclaracao.assinatura}>
          <View style={estiloDeclaracao.linhaAssinatura} />
          <Text style={estiloDeclaracao.nomeAssinatura}>
            {diretorNome.toUpperCase()}
          </Text>
          <Text style={estiloDeclaracao.cargoAssinatura}>
            Diretor Acadêmico
          </Text>
        </View>

        <Text style={estiloDeclaracao.rodape}>
          Avenida Brasil, 45 - Fone (43) 3472-0201 - CEP 86870-000 - Ivaiporã
          /Paraná{"\n"}www.fatecivaipora.com.br
        </Text>
      </Page>
    </Document>
  );
}
