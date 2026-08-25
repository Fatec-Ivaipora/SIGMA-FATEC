import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let app: App | undefined;

/** Inicialização preguiçosa — só falha (com mensagem clara) quando uma rota
 * de API realmente precisar do Admin SDK, nunca no import do módulo. */
function getAdminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Credenciais do Firebase Admin ausentes — configure FIREBASE_ADMIN_PROJECT_ID, " +
        "FIREBASE_ADMIN_CLIENT_EMAIL e FIREBASE_ADMIN_PRIVATE_KEY em .env.local.",
    );
  }

  app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
