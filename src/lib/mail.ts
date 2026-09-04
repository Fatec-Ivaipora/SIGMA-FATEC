import { getAdminDb } from "@/lib/firebaseAdmin";

/** Fila de e-mail via extensão "Trigger Email" do Firebase (2026-09-04) —
 * escrever um doc na coleção `mail` é o que dispara o envio de verdade (a
 * extensão observa essa coleção; sem ela instalada, os docs só ficam
 * parados ali, sem erro nenhum). Só server-side (usa firebase-admin) — o
 * client nunca escreve em `mail` diretamente (ver firestore.rules,
 * `allow write: if false`), sempre passa por uma rota /api/mail/* que
 * primeiro busca os dados de verdade no Firestore antes de montar o
 * e-mail — nunca confia em destinatário/conteúdo vindo do client. */
export async function enviarEmail(dados: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  await getAdminDb()
    .collection("mail")
    .add({
      to: dados.to,
      message: {
        subject: dados.subject,
        html: dados.html,
        text: dados.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      },
    });
}

const URL_SISTEMA = "https://sigma.fatecivaipora.com.br";

/** Moldura visual comum a todos os e-mails do SIGMA — mantém consistência
 * sem precisar repetir o HTML em cada trigger. `corpoHtml` é só o miolo
 * (título + parágrafos); botão é opcional. */
export function modeloEmail(corpoHtml: string, botao?: { texto: string; href: string }) {
  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px 0;">
      <p style="margin:0 0 24px;font-size:13px;font-weight:700;letter-spacing:0.02em;color:#0051B2;text-transform:uppercase;">
        SIGMA · Fatec Ivaiporã
      </p>
      <div style="font-size:15px;line-height:1.6;color:#1a1a1a;">
        ${corpoHtml}
      </div>
      ${
        botao
          ? `<p style="margin:28px 0 0;">
              <a href="${botao.href}" style="display:inline-block;background:#F05A24;color:#ffffff;font-weight:600;font-size:14px;padding:12px 24px;border-radius:999px;text-decoration:none;">
                ${botao.texto}
              </a>
            </p>`
          : ""
      }
      <p style="margin:32px 0 0;font-size:12px;color:#8a8a8a;">
        Fatec Ivaiporã — este e-mail é automático, não precisa responder.
      </p>
    </div>
  `;
}

export { URL_SISTEMA };
