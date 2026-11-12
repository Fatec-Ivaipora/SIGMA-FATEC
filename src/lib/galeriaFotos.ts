import { randomUUID } from "crypto";
import { getStorage } from "firebase-admin/storage";
import { getAdminDb } from "@/lib/firebaseAdmin";

/** Galeria pública de fotos do evento (2026-11-12, pedido explícito do
 * usuário — fotos da X MAC numa pasta do Google Drive, "precisamos colocar no
 * sistema" e "precisa sempre estar atualizado"). As fotos são COPIADAS para o
 * Storage (eventos/{eventoId}/fotos/, caminho já público para leitura em
 * storage.rules): original + versão de tela (1600px) + miniatura (480px). O
 * índice fica em eventos/{eventoId}/fotos/index.json.
 *
 * Sincronização: a pasta do Drive precisa estar "qualquer pessoa com o link".
 * A lista vem da visualização pública da pasta (embeddedfolderview, sem chave
 * de API) e cada foto do download público (uc?export=download). Só entra o
 * que ainda não está no índice; foto apagada no Drive continua na galeria
 * (nada é removido automaticamente). */

export type FotoGaleria = {
  driveId: string;
  nome: string;
  original: string;
  web: string;
  mini: string;
  largura?: number;
  altura?: number;
  tamanhoOriginal: number;
};

export type IndiceGaleria = {
  atualizadoEm: string;
  verificadoEm?: string;
  fotos: FotoGaleria[];
};

const INTERVALO_VERIFICACAO_MS = 10 * 60 * 1000;
const EXT_IMAGEM = /\.(jpe?g|png|webp|heic)$/i;

function bucket() {
  getAdminDb(); // garante o app inicializado
  return getStorage().bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
}

// Link de download com token (o mesmo que o getDownloadURL do Firebase gera):
// funciona sem login e independe de storage.rules — a regra pública de
// eventos/{eventoId}/{arquivo} só cobre UM nível, e as fotos ficam em
// subpastas (fotos/original|web|mini).
function urlPublica(caminho: string, token: string) {
  const b = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  return `https://firebasestorage.googleapis.com/v0/b/${b}/o/${encodeURIComponent(caminho)}?alt=media&token=${token}`;
}

/** Aceita o link inteiro da pasta (…/folders/ID…) ou só o ID. */
export function extrairIdPastaDrive(valor: string): string | null {
  const v = valor.trim();
  const m = v.match(/folders\/([A-Za-z0-9_-]{10,})/) ?? v.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(v) ? v : null;
}

export async function lerIndice(eventoId: string): Promise<IndiceGaleria> {
  const arq = bucket().file(`eventos/${eventoId}/fotos/index.json`);
  const [existe] = await arq.exists();
  if (!existe) return { atualizadoEm: "", fotos: [] };
  const [conteudo] = await arq.download();
  return JSON.parse(conteudo.toString()) as IndiceGaleria;
}

async function salvarIndice(eventoId: string, indice: IndiceGaleria) {
  indice.fotos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
  await bucket()
    .file(`eventos/${eventoId}/fotos/index.json`)
    .save(JSON.stringify(indice), {
      contentType: "application/json",
      resumable: false,
      metadata: { cacheControl: "no-cache" },
    });
}

/** Lista {id, nome} das imagens da pasta pública do Drive. */
async function listarPastaDrive(pastaId: string): Promise<{ id: string; nome: string }[]> {
  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${pastaId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Pasta do Drive inacessível (${res.status}) — está compartilhada com "qualquer pessoa com o link"?`);
  const html = await res.text();
  const itens: { id: string; nome: string }[] = [];
  const re = /id="entry-([A-Za-z0-9_-]+)"[\s\S]*?flip-entry-title">([^<]+)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const nome = m[2].replace(/&amp;/g, "&").trim();
    if (EXT_IMAGEM.test(nome)) itens.push({ id: m[1], nome });
  }
  return itens;
}

async function baixar(url: string): Promise<{ dados: Buffer; tipo: string }> {
  const res = await fetch(url, { cache: "no-store" });
  const tipo = res.headers.get("content-type") ?? "";
  if (!res.ok || !tipo.startsWith("image/")) throw new Error(`download ${res.status} ${tipo}`);
  return { dados: Buffer.from(await res.arrayBuffer()), tipo };
}

/** Original pelo download público; versão de tela (1600px) e miniatura
 * (480px) pela miniatura pública do próprio Drive — sem precisar de
 * biblioteca de imagem no servidor. */
async function processarFoto(eventoId: string, f: { id: string; nome: string }): Promise<FotoGaleria> {
  const orig = await baixar(`https://drive.google.com/uc?export=download&id=${f.id}`);
  const web = await baixar(`https://drive.google.com/thumbnail?id=${f.id}&sz=w1600`);
  const mini = await baixar(`https://drive.google.com/thumbnail?id=${f.id}&sz=w480`);
  const base = `eventos/${eventoId}/fotos`;
  const nome = f.nome.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_");
  const ext = (f.nome.match(/\.[^.]+$/)?.[0] ?? ".jpg").toLowerCase();
  const token = randomUUID();
  const opts = (ct: string) => ({
    contentType: ct,
    resumable: false,
    metadata: {
      cacheControl: "public, max-age=31536000",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  const b = bucket();
  await b.file(`${base}/original/${nome}${ext}`).save(orig.dados, opts(orig.tipo));
  await b.file(`${base}/web/${nome}.jpg`).save(web.dados, opts(web.tipo));
  await b.file(`${base}/mini/${nome}.jpg`).save(mini.dados, opts(mini.tipo));
  return {
    driveId: f.id,
    nome: f.nome,
    original: urlPublica(`${base}/original/${nome}${ext}`, token),
    web: urlPublica(`${base}/web/${nome}.jpg`, token),
    mini: urlPublica(`${base}/mini/${nome}.jpg`, token),
    tamanhoOriginal: orig.dados.length,
  };
}

/** Puxa do Drive as fotos que ainda não estão na galeria (no máximo
 * `limite` por chamada, pra caber no tempo da função). Sem `forcar`, não faz
 * nada se a última verificação foi há menos de 10 min. */
export async function sincronizarGaleria(
  eventoId: string,
  pastaId: string,
  { limite = 20, forcar = false }: { limite?: number; forcar?: boolean } = {},
): Promise<{ novas: number; pendentes: number; total: number; pulou?: boolean }> {
  const indice = await lerIndice(eventoId);
  const ultima = Date.parse(indice.verificadoEm ?? indice.atualizadoEm ?? "") || 0;
  if (!forcar && Date.now() - ultima < INTERVALO_VERIFICACAO_MS) {
    return { novas: 0, pendentes: 0, total: indice.fotos.length, pulou: true };
  }
  // Marca a verificação antes de processar — evita duas visitas seguidas
  // disparando o mesmo trabalho em paralelo.
  indice.verificadoEm = new Date().toISOString();
  await salvarIndice(eventoId, indice);

  const noDrive = await listarPastaDrive(pastaId);
  const jaTem = new Set(indice.fotos.map((f) => f.driveId));
  const faltam = noDrive.filter((f) => !jaTem.has(f.id));
  let novas = 0;
  for (const f of faltam.slice(0, limite)) {
    try {
      indice.fotos.push(await processarFoto(eventoId, f));
      novas++;
    } catch {
      // foto com problema fica pra próxima verificação
    }
  }
  if (novas) indice.atualizadoEm = new Date().toISOString();
  // Ainda faltando? Libera a próxima verificação logo na visita seguinte.
  if (faltam.length > novas) indice.verificadoEm = new Date(0).toISOString();
  await salvarIndice(eventoId, indice);
  return { novas, pendentes: faltam.length - novas, total: indice.fotos.length };
}
