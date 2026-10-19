import path from "node:path";
import fs from "node:fs";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { AssinanteCertificado } from "@/lib/assinantesCertificado";

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

/** Período no texto da Ata (2026-10-19) — fraseado diferente do certificado
 * de propósito, pra bater igualzinho com o modelo real usado pela
 * instituição (ver exemplo em Mateus/exemplos): "no dia X" (1 dia) ou "do
 * dia X e Y" (vários dias) — não "de X a Y" como formatarPeriodoRealizacao
 * acima, que é pro certificado, não pra ata. */
function periodoAta(inicio: string, fim?: string): string {
  if (!fim || fim === inicio) return `no dia ${formatarDataNumerica(inicio)}`;
  return `do dia ${formatarDataNumerica(inicio)} e ${formatarDataNumerica(fim)}`;
}

/** Texto do período de realização (2026-09-30) — "realizado em 08/10/2026"
 * pra evento de 1 dia (fim ausente/igual ao início, comportamento de
 * sempre), "realizado de 08/10/2026 a 10/10/2026" pra evento multi-dia. Ver
 * Evento.dataRealizacaoFim em src/lib/data/eventos.ts — achado pelo usuário
 * testando a Semana de Medicina: antes só a data de início aparecia no
 * certificado, mesmo pra um evento de 3 dias, o que ficava estranho ao lado
 * da carga horária total (16h parecia um evento de 1 dia só). */
export function formatarPeriodoRealizacao(inicio: string, fim?: string): string {
  if (!fim || fim === inicio) return `realizado em ${formatarDataNumerica(inicio)}`;
  return `realizado de ${formatarDataNumerica(inicio)} a ${formatarDataNumerica(fim)}`;
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

// Assinaturas digitalizadas (2026-09-11) — só o rabisco, recortado da foto
// original (que também tinha linha + nome + cargo impressos junto) pra
// sobrepor a própria linha/nome/cargo que a gente já desenha embaixo, sem
// duplicar nada.
//
// id -> imagem (2026-10-05, generalizado — antes era um mapa por cargo fixo,
// "diretor"/"coordenador"; agora qualquer cargo cadastrado em
// ASSINANTES_CERTIFICADO, ver src/lib/assinantesCertificado.ts, pode ter uma
// entrada aqui). Um id sem entrada aqui (assinante cadastrado no catálogo
// mas sem arquivo de assinatura ainda) cai em `undefined`, e BlocoAssinatura
// sabe lidar com isso (mostra nome/cargo sem a imagem da assinatura, em vez
// de quebrar o PDF) — pra adicionar alguém novo, ver o comentário no topo de
// assinantesCertificado.ts.
const IMAGEM_POR_ASSINANTE: Record<string, { data: Buffer; format: "jpg" | "png" }> = {
  roni: {
    data: fs.readFileSync(
      path.join(process.cwd(), "public", "certificados", "assinatura-roni.jpg"),
    ),
    format: "jpg",
  },
  joao: {
    data: fs.readFileSync(
      path.join(process.cwd(), "public", "certificados", "assinatura-joao.jpg"),
    ),
    format: "jpg",
  },
  // .png, não .jpg (2026-10-06, pedido explícito do usuário) — tinta preta
  // (era azul) sobre fundo TRANSPARENTE (era a folha branca da foto
  // aparecendo, destacava feio sobre o fundo ilustrado do certificado de
  // apresentação) — .jpg não tem canal alpha, só .png segura isso.
  bruno: {
    data: fs.readFileSync(
      path.join(process.cwd(), "public", "certificados", "assinatura-bruno.png"),
    ),
    format: "png",
  },
};

/** Logo padrão do cabeçalho (2026-10-19, pedido explícito do usuário — a
 * versão anterior era só texto "FATEC"/"IVP" desenhado à mão, ficou muito
 * diferente da logo real; arquivo real fornecido pelo usuário). Usada em
 * DeclaracaoPDF e AtaRegistroPDF sempre que não há uma logo alternativa
 * por evento (ver LOGO_CABECALHO abaixo, ex.: MED FATEC). */
const LOGO_PADRAO: { data: Buffer; format: "png" } = {
  data: fs.readFileSync(path.join(process.cwd(), "public", "certificados", "logo-fatec-ivp.png")),
  format: "png",
};

/** Logo alternativa no cabeçalho da declaração, no lugar da logo padrão
 * acima (2026-10-06) — ver `logoCertificadoId` em
 * src/lib/data/eventos.ts. Catálogo code-level, mesmo espírito de
 * IMAGEM_POR_ASSINANTE (cadastro manual, sem UI própria ainda). Fundo
 * removido (era um cinza bem claro, #f7f7f7, da imagem original — contra o
 * fundo branco puro da página destacava como um retângulo). */
const LOGO_CABECALHO: Record<string, { data: Buffer; format: "png" }> = {
  medfatec: {
    data: fs.readFileSync(
      path.join(process.cwd(), "public", "certificados", "logo-medfatec.png"),
    ),
    format: "png",
  },
};

const cores = {
  navy900: "#0a2c47",
  navy800: "#0e3a5e",
  ink: "#142433",
  muted: "#5b6b78",
};

/** Bloco de uma assinatura (imagem + linha + nome + cargo) — compartilhado
 * entre CertificadoApresentacaoPDF e DeclaracaoPDF (2026-09-29, antes cada um
 * tinha o próprio JSX repetido). `imagem` é opcional (2026-09-30) — só fica
 * undefined se o id do assinante não bater com nenhum cadastrado em
 * IMAGEM_POR_ASSINANTE (assinante novo no catálogo sem o arquivo de
 * assinatura cadastrado ainda); nesse caso mostra só a linha/nome/cargo, sem
 * quebrar o PDF por causa de uma imagem ausente. */
function BlocoAssinatura({
  imagem,
  nome,
  cargo,
  estilos,
}: {
  imagem: { data: Buffer; format: "jpg" | "png" } | undefined;
  nome: string;
  cargo: string;
  estilos: {
    assinatura: Style;
    imagemAssinatura: Style;
    linhaAssinatura: Style;
    nomeAssinatura: Style;
    cargoAssinatura: Style;
  };
}) {
  return (
    <View style={estilos.assinatura}>
      {imagem && <Image src={imagem} style={estilos.imagemAssinatura} />}
      <View style={estilos.linhaAssinatura} />
      <Text style={estilos.nomeAssinatura}>{nome.toUpperCase()}</Text>
      <Text style={estilos.cargoAssinatura}>{cargo}</Text>
    </View>
  );
}

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
  // flexWrap (2026-10-05) — até 2 assinaturas cabem numa linha só com
  // width 290 cada (confortável, cargo mais longo não quebra); a partir de
  // 3 (catálogo deixou de ter só 2 cargos fixos, ver assinantesCertificado.ts)
  // pode não caber mais widths de 290 lado a lado na área útil da página —
  // em vez de estourar a margem, quebra pra uma segunda linha.
  assinaturas: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 50,
  },
  assinatura: {
    alignItems: "center",
    // Alargado (2026-09-11) — 220 era estreito demais pro cargo mais longo
    // ("Coordenador(a) da Pesquisa e Formação Científica"), quebrava em 2
    // linhas e desalinhava o par (o outro lado, "Diretor Acadêmico", cabe
    // numa linha só). 290 cabe os dois cargos numa linha, mantendo o par
    // nivelado.
    width: 290,
  },
  // Altura fixa, não largura (2026-09-11) — as duas assinaturas têm
  // proporções diferentes; travar a largura igual deixava alturas
  // diferentes, empurrando a linha de cada lado pra uma posição diferente
  // (o par ficava "torto"). Com a altura igual, a linha cai no mesmo lugar
  // nos dois lados, a largura de cada uma varia livre conforme a proporção.
  imagemAssinatura: {
    height: 48,
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
  assinantes,
  premiado,
}: {
  nomes: string[];
  eventoNome: string;
  dataRealizacao: string;
  tituloTrabalho: string;
  registroNumero: number;
  // Quem assina esse evento (2026-10-05, era diretorNome?/coordenadorNome?
  // fixos — ver assinantesCertificado.ts) — pelo menos 1 é exigido antes de
  // chegar aqui (ver faltandoDadosEvento em src/app/api/certificados/route.ts).
  assinantes: AssinanteCertificado[];
  // Top 3 da área ganha CERTIFICADO ("certificamos", tom de reconhecimento,
  // edital 6.6); quem participou sem ficar entre os 3 primeiros ganha
  // DECLARAÇÃO ("declaramos", só comprova participação) — 2026-09-11, mesmo
  // PDF/estrutura pros dois, só muda essa palavra. Ver trabalho.premiado em
  // src/lib/data/trabalhos.ts.
  premiado: boolean;
}) {
  const plural = nomes.length > 1;
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={estiloApresentacao.page}>
        <Image fixed src={FUNDO_APRESENTACAO} style={estiloApresentacao.fundo} />
        <View style={estiloApresentacao.conteudo}>
          <Text style={estiloApresentacao.rotulo}>
            {premiado ? "Certificamos que" : "Declaramos que"}
          </Text>
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
            {assinantes.map((a) => (
              <BlocoAssinatura
                key={a.id}
                imagem={IMAGEM_POR_ASSINANTE[a.id]}
                nome={a.nome}
                cargo={a.cargo}
                estilos={estiloApresentacao}
              />
            ))}
          </View>
        </View>
        <Text fixed style={estiloApresentacao.registro}>
          REGISTRO SOB O N° {registroNumero}, LIVRO N° 01
        </Text>
      </Page>
    </Document>
  );
}

const PAPEL_TEXTO: Record<
  "avaliador" | "moderador" | "orientador" | "monitor" | "participante",
  string
> = {
  avaliador: "avaliador(a) dos trabalhos",
  moderador: "moderador(a) dos trabalhos",
  orientador: "orientador(a) de projeto",
  monitor: "monitor(a) de apoio ao evento",
  // Certificado de participação (2026-09-22) — evento "simples", sem
  // trabalho por trás, só a inscrição paga (ou gratuita) da pessoa.
  participante: "participante",
};

const estiloDeclaracao = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    paddingTop: 50,
    paddingHorizontal: 55,
    paddingBottom: 40,
  },
  // `gap` baixo de propósito (2026-10-19, pedido explícito do usuário —
  // "empurre o texto pra esquerda", comparando com o modelo real: o texto
  // de credenciamento cola quase direto na logo, não fica solto no meio
  // da página).
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: cores.navy800,
    paddingBottom: 12,
    marginBottom: 60,
  },
  // Duas alturas, não uma (2026-10-19, achado real do usuário: o
  // certificado da Medicina, que usa MED FATEC — ver logoCertificadoId —
  // saiu "gigante" depois do ajuste pra 80, porque as duas logos têm
  // proporção bem diferente: LOGO_PADRAO é quase quadrada (554×312), MED
  // FATEC é bem mais larga/achatada (1488×250, mais de 3x mais larga que
  // alta) — mesma altura nunca ia dar larguras parecidas.
  // 28, não 40 (2026-10-19, segundo achado real — 40 ainda quebrava linha
  // num certificado de verdade; MED FATEC precisa de bem menos altura que
  // LOGO_PADRAO exatamente por ser tão mais larga/achatada).
  // `logoCabecalho` é pra logo de EVENTO (override, ex.: MED FATEC).
  // `logoCabecalhoPadrao` é só pra LOGO_PADRAO (sem override) — ver
  // DeclaracaoPDF.
  logoCabecalho: {
    height: 28,
  },
  // 65, não 80 (2026-10-19, pedido explícito do usuário — achado real
  // comparando com um certificado de verdade: em 80 o texto de
  // credenciamento ao lado ficava espremido, quebrando palavra por
  // palavra em vez das 3 linhas limpas do modelo).
  logoCabecalhoPadrao: {
    height: 65,
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
  // Linha com 1+ blocos, centralizada (2026-09-29 — antes só existia
  // "assinatura" singular, sempre 1 assinatura só). flexWrap (2026-10-05) —
  // mesmo motivo de estiloApresentacao.assinaturas, catálogo de assinantes
  // deixou de ter só 2 cargos fixos.
  // width 210, não mais 260 (2026-10-06) — 260×2+gap já passava da largura
  // útil da página (A4 retrato, paddingHorizontal 55 nos dois lados ≈ 485pt
  // disponíveis), e com 3 assinantes (catálogo deixou de ter só 2 cargos
  // fixos) quase sempre precisa quebrar pra uma 2ª linha mesmo — o
  // marginBottom abaixo garante respiro antes do rodapé nesse caso, achado
  // do usuário testando com 3 assinantes (cargo do Bruno colou no endereço).
  assinaturas: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 40,
    marginBottom: 24,
  },
  assinatura: {
    alignItems: "center",
    width: 210,
  },
  // Altura fixa, não largura (2026-09-11) — as duas assinaturas têm
  // proporções diferentes; travar a largura igual deixava alturas
  // diferentes, empurrando a linha de cada lado pra uma posição diferente
  // (o par ficava "torto"). Com a altura igual, a linha cai no mesmo lugar
  // nos dois lados, a largura de cada uma varia livre conforme a proporção.
  imagemAssinatura: {
    height: 48,
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
  // Só usado quando registroNumero vem preenchido (hoje, só participante).
  // Alinhado à direita, no fluxo normal da página — não mais rodapé fixo
  // (2026-10-19, pedido explícito do usuário, testado primeiro à esquerda)
  // — fica entre a data e o bloco de assinaturas.
  registro: {
    textAlign: "right",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: cores.navy800,
    marginBottom: 16,
  },
});

export function DeclaracaoPDF({
  nome,
  papel,
  eventoNome,
  dataRealizacao,
  dataRealizacaoFim,
  cargaHoraria,
  assinantes,
  dataAssinatura,
  logoCabecalhoId,
  registroNumero,
}: {
  nome: string;
  papel: "avaliador" | "moderador" | "orientador" | "monitor" | "participante";
  eventoNome: string;
  dataRealizacao: string;
  // Opcional (2026-09-30) — só vem preenchido pra evento "simples" de mais
  // de 1 dia; ver formatarPeriodoRealizacao acima.
  dataRealizacaoFim?: string;
  cargaHoraria: number;
  // Mesmo espírito de CertificadoApresentacaoPDF (2026-10-05) — ver
  // assinantesCertificado.ts.
  assinantes: AssinanteCertificado[];
  dataAssinatura: string;
  // Logo no lugar do texto "FATEC/IVP" (2026-10-06) — ver
  // evento.logoCertificadoId em src/lib/data/eventos.ts. Sem id, ou id sem
  // entrada em LOGO_CABECALHO, cai no texto padrão (nunca quebra o PDF).
  logoCabecalhoId?: string;
  // Opcional (2026-10-19, pedido explícito do usuário — achado real:
  // participante de evento "simples" usa esse documento pra comprovar
  // hora complementar, e precisa do número de registro, diferente de
  // avaliador/moderador/orientador/monitor, que continuam sem — "não
  // aparece nos exemplos reais" pra esses papéis, ver route.ts). Ausente =
  // sem a linha de registro, exatamente como já era antes.
  registroNumero?: number;
}) {
  const logoDoEvento = logoCabecalhoId ? LOGO_CABECALHO[logoCabecalhoId] : undefined;
  return (
    <Document>
      <Page size="A4" wrap={false} style={estiloDeclaracao.page}>
        <View style={estiloDeclaracao.cabecalho}>
          {logoDoEvento ? (
            <Image src={logoDoEvento} style={estiloDeclaracao.logoCabecalho} />
          ) : (
            <Image src={LOGO_PADRAO} style={estiloDeclaracao.logoCabecalhoPadrao} />
          )}
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
          Faculdade de Tecnologia do Vale do Ivaí – FATEC. O evento foi{" "}
          {formatarPeriodoRealizacao(dataRealizacao, dataRealizacaoFim)}, com
          carga horária de {String(cargaHoraria).padStart(2, "0")} horas.
        </Text>

        <Text style={estiloDeclaracao.fechamento}>
          Por ser expressão da verdade, firmamos a presente.
        </Text>

        <Text style={estiloDeclaracao.data}>
          Ivaiporã, {formatarDataExtenso(dataAssinatura)}
        </Text>

        {registroNumero !== undefined && (
          <Text style={estiloDeclaracao.registro}>
            REGISTRO SOB O N° {registroNumero}, LIVRO N° 01
          </Text>
        )}

        <View style={estiloDeclaracao.assinaturas}>
          {assinantes.map((a) => (
            <BlocoAssinatura
              key={a.id}
              imagem={IMAGEM_POR_ASSINANTE[a.id]}
              nome={a.nome}
              cargo={a.cargo}
              estilos={estiloDeclaracao}
            />
          ))}
        </View>

        <Text style={estiloDeclaracao.rodape}>
          Avenida Brasil, 45 - Fone (43) 3472-0201 - CEP 86870-000 - Ivaiporã
          /Paraná{"\n"}www.fatecivaipora.com.br
        </Text>
      </Page>
    </Document>
  );
}

const estiloAta = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    paddingTop: 50,
    paddingHorizontal: 55,
    paddingBottom: 60,
  },
  // Mesmo ajuste de estiloDeclaracao.cabecalho acima (2026-10-19).
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: cores.navy800,
    paddingBottom: 12,
    marginBottom: 30,
  },
  // Mesmo ajuste de estiloDeclaracao.logoCabecalhoPadrao acima
  // (2026-10-19) — sempre LOGO_PADRAO aqui, nunca tem override por
  // evento como MED FATEC.
  logoCabecalho: {
    height: 65,
  },
  textoCredenciamento: {
    flex: 1,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: cores.navy800,
    lineHeight: 1.5,
  },
  titulo: {
    fontSize: 12,
    color: cores.ink,
    marginBottom: 10,
  },
  evento: {
    fontSize: 12,
    color: cores.ink,
    marginBottom: 2,
  },
  participantes: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: cores.ink,
    marginBottom: 14,
  },
  corpo: {
    fontSize: 11,
    color: cores.ink,
    lineHeight: 1.5,
    textAlign: "justify",
    marginBottom: 18,
  },
  negrito: {
    fontFamily: "Helvetica-Bold",
  },
  tabela: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: cores.ink,
  },
  linhaCabecalho: {
    flexDirection: "row",
  },
  linha: {
    flexDirection: "row",
  },
  celulaRegistroCabecalho: {
    width: 90,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: cores.ink,
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  celulaNomeCabecalho: {
    flex: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: cores.ink,
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  celulaRegistro: {
    width: 90,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: cores.ink,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 10,
    textAlign: "center",
  },
  celulaNome: {
    flex: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: cores.ink,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 10,
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

/** Ata de Registro (2026-10-19, pedido explícito do usuário) — documento
 * obrigatório da instituição quando libera certificado: lista, do primeiro
 * ao último número usado NESSE evento, quem recebeu cada um (nome +
 * número), pra arquivar e saber onde continuar no próximo evento. Modelo
 * copiado de um exemplo real da instituição (ver Mateus/exemplos/ATA ...
 * .doc) — mesmo cabeçalho/rodapé dos certificados, mas layout próprio
 * (sem assinatura, com tabela). Número da própria ata ("Nº 563/2026",
 * "LIVRO 01") é digitado por quem gera, de propósito (2026-10-19, pedido
 * explícito do usuário) — já existe um controle desse número fora do
 * sistema, não dá pra arriscar o SIGMA divergir dele com um contador
 * próprio. `registros` já vem ordenado do menor pro maior número — ver
 * GET /api/certificados/ata, que lê `registrosCertificados` por eventoId. */
// "Livro" (2026-10-19) não aparece no corpo do documento — conferido no
// exemplo real (Mateus/exemplos/ATA ....doc): só existe no NOME do
// arquivo ("ATA 563 - 2026 - LIVRO 01 ..."), não no texto impresso. Por
// isso `AtaRegistroPDF` não recebe `livro` — só a rota
// (/api/certificados/ata) usa pra montar o nome do PDF baixado.
export function AtaRegistroPDF({
  numeroAta,
  ano,
  eventoNome,
  dataRealizacao,
  dataRealizacaoFim,
  diretorNome,
  registros,
}: {
  numeroAta: number;
  ano: number;
  eventoNome: string;
  dataRealizacao: string;
  dataRealizacaoFim?: string;
  diretorNome: string;
  registros: { numero: number; nome: string }[];
}) {
  return (
    <Document>
      <Page size="A4" style={estiloAta.page}>
        <View style={estiloAta.cabecalho}>
          <Image src={LOGO_PADRAO} style={estiloAta.logoCabecalho} />
          <Text style={estiloAta.textoCredenciamento}>
            Mantida pela União de Ensino Superior do Vale do Ivaí Ltda -
            UNESVI{"\n"}
            Credenciamento EaD - Portaria n° 874 de 28 de novembro de 2025
            {"\n"}
            Recredenciamento - Portaria n° 878 de 28 de novembro de 2025
          </Text>
        </View>

        <Text style={estiloAta.titulo}>
          Ata de Registro N° {numeroAta}/{ano}
        </Text>
        <Text style={estiloAta.evento}>Evento: {eventoNome.toUpperCase()}</Text>
        <Text style={estiloAta.participantes}>Participantes</Text>

        <Text style={estiloAta.corpo}>
          O Diretor Acadêmico da Faculdade de Tecnologia do Vale do Ivaí –
          Fatec, {diretorNome}, dentro das normas estabelecidas no
          Regimento Interno de Ensino, realiza os Registros do Certificado
          da{" "}
          <Text style={estiloAta.negrito}>{eventoNome.toUpperCase()}</Text>.
          Que aconteceu {periodoAta(dataRealizacao, dataRealizacaoFim)}.
          Conforme lista de presença abaixo nominada:
        </Text>

        <View style={estiloAta.tabela}>
          {/* fixed (2026-10-19, pedido explícito do usuário — "cada folha
              ser uma planilha, não uma só que passa de folha a folha") —
              repete "Registro | NOME" no topo de toda página nova que a
              tabela precisar, não só na primeira. wrap={false} em cada
              LINHA (abaixo) é o que resolve o problema relatado de
              verdade: sem isso, o react-pdf podia cortar uma linha no
              meio quando ela não cabia no fim da página — metade embaixo,
              metade no topo da próxima. Com wrap={false}, a linha inteira
              pula pra próxima página se não couber, nunca corta. */}
          <View style={estiloAta.linhaCabecalho} fixed>
            <Text style={estiloAta.celulaRegistroCabecalho}>Registro</Text>
            <Text style={estiloAta.celulaNomeCabecalho}>NOME</Text>
          </View>
          {registros.map((r) => (
            <View key={r.numero} style={estiloAta.linha} wrap={false}>
              <Text style={estiloAta.celulaRegistro}>{r.numero}</Text>
              <Text style={estiloAta.celulaNome}>{r.nome.toUpperCase()}</Text>
            </View>
          ))}
        </View>

        <Text fixed style={estiloAta.rodape}>
          Avenida Brasil, 45 - Fone (43) 3472-0201 - CEP 86870-000 - Ivaiporã
          /Paraná{"\n"}www.fatecivaipora.com.br
        </Text>
      </Page>
    </Document>
  );
}
