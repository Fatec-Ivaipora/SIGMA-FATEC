"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import type { User } from "firebase/auth";
import { Modal } from "@/components/Modal";

/** Ícone de sucesso animado (2026-10-07, pedido explícito do usuário — "tá
 * muito seco, escaneia e não tem nada visual que deu certo") — círculo e
 * check desenhando via stroke-dashoffset (keyframes `sigma-draw`/
 * `sigma-pop-in` em globals.css), mesma técnica clássica de "pagamento
 * confirmado". `prefers-reduced-motion` desliga o desenho e mostra tudo
 * já completo na hora (ver @media em globals.css) — a confirmação em si
 * nunca depende da animação pra ser compreendida. */
function IconeSucesso() {
  return (
    <div className="sigma-anim-pop flex h-16 w-16 items-center justify-center">
      <svg viewBox="0 0 64 64" className="h-16 w-16" fill="none" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r="27"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          className="sigma-anim-circle text-emerald-500"
        />
        <path
          d="M18 34 L27 43 L47 21"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="sigma-anim-check text-emerald-600"
        />
      </svg>
    </div>
  );
}

/** Confirmação de presença por QR (2026-09-23, evento "simples") — abre a
 * câmera do aluno (html5-qrcode cuida de pedir permissão/mostrar preview),
 * decodifica o QR exibido pela organização no local do evento e manda pra
 * /api/inscricoes/confirmar-presenca validar (o código rotaciona a cada
 * minuto, ver src/lib/qrPresenca.ts — não dá pra validar isso no client). */
export function ConfirmarPresencaModal({
  open,
  eventoId,
  user,
  onClose,
}: {
  open: boolean;
  eventoId: string;
  user: User | null | undefined;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"escaneando" | "enviando" | "erro" | "sucesso">(
    "escaneando",
  );
  const [erro, setErro] = useState<string | null>(null);
  const processandoRef = useRef(false);

  // Reseta o estado visual quando o modal abre — ajuste de estado durante a
  // renderização (padrão recomendado pelo React pra "adjusting state when a
  // prop changes"), não dentro do efeito abaixo, que só cuida do scanner em
  // si (sistema externo).
  const [abertoAnterior, setAbertoAnterior] = useState(open);
  if (open !== abertoAnterior) {
    setAbertoAnterior(open);
    if (open) {
      setStatus("escaneando");
      setErro(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    processandoRef.current = false;

    // Html5Qrcode (2026-09-30, era Html5QrcodeScanner) — o "Scanner" com UI
    // própria não pede a câmera sozinho, mostra uma tela intermediária com
    // botão "Request Camera Permissions" + "Scan an Image File" primeiro
    // (achado: aluno clicava em "Confirmar presença" e via essa tela em vez
    // da câmera direto). Html5Qrcode é a API mais crua — start() já dispara
    // o pedido de permissão do navegador na hora, sem esse intermediário.
    const scanner = new Html5Qrcode("confirmar-presenca-leitor");
    let cancelado = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async (textoDecodificado) => {
          if (processandoRef.current) return;
          processandoRef.current = true;
          try {
            scanner.pause(true);
          } catch {
            // câmera pode já ter parado sozinha, sem problema
          }

          // Confere o eventoId antes de gastar uma chamada — o texto do QR é
          // "eventoId|janela|codigo" (ver montarTextoQr em src/lib/qrPresenca.ts,
          // não importado aqui porque usa node:crypto, só roda no servidor).
          if (!textoDecodificado.startsWith(`${eventoId}|`)) {
            setErro("Esse QR é de outro evento — confira se está no lugar certo.");
            setStatus("erro");
            processandoRef.current = false;
            try {
              scanner.resume();
            } catch {
              // idem
            }
            return;
          }

          if (!user) return;
          setStatus("enviando");
          try {
            const idToken = await user.getIdToken();
            const res = await fetch("/api/inscricoes/confirmar-presenca", {
              method: "POST",
              headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ texto: textoDecodificado }),
            });
            const corpo = await res.json();
            if (!res.ok) {
              setErro(corpo.erro ?? "Não foi possível confirmar. Tente de novo.");
              setStatus("erro");
              processandoRef.current = false;
              try {
                scanner.resume();
              } catch {
                // idem
              }
              return;
            }
            setStatus("sucesso");
          } catch {
            setErro("Falha de conexão. Tente de novo.");
            setStatus("erro");
            processandoRef.current = false;
            try {
              scanner.resume();
            } catch {
              // idem
            }
          }
        },
        () => {
          // erro de leitura por frame (nada legível no quadro) — ignorado,
          // html5-qrcode chama isso continuamente enquanto não acha nada.
        },
      )
      .then(() => {
        // Modal fechado enquanto o navegador ainda esperava a resposta da
        // permissão — start() só resolve depois, com a câmera já ligada e
        // o cleanup abaixo já tendo rodado (isScanning era false na hora).
        // Sem isso a câmera ficaria acesa mesmo com o modal fechado.
        if (!cancelado) return;
        scanner
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scanner.clear();
            } catch {
              // idem
            }
          });
      })
      .catch(() => {
        // start() rejeita se a pessoa negar a permissão da câmera, ou se o
        // navegador/dispositivo não tiver câmera nenhuma disponível.
        if (cancelado) return;
        setErro(
          "Não foi possível acessar a câmera — verifique se a permissão foi liberada nas configurações do navegador.",
        );
        setStatus("erro");
      });

    return () => {
      cancelado = true;
      // stop() só é válido com a câmera de fato rodando (isScanning) — sem
      // essa checagem, fechar o modal antes do start() terminar (ou depois
      // de já ter parado sozinho) rejeita a promise sem necessidade.
      const parar = scanner.isScanning ? scanner.stop() : Promise.resolve();
      parar
        .catch(() => {
          // idem, já parado por outro caminho
        })
        .finally(() => {
          try {
            scanner.clear();
          } catch {
            // elemento já pode ter sido desmontado
          }
        });
    };
  }, [open, eventoId, user]);

  // Fecha sozinho depois de mostrar a animação de sucesso (2026-10-07) —
  // antes o modal fechava na MESMA hora que confirmava (onConfirmado batia
  // junto com setStatus("sucesso"), React processa os dois na mesma
  // renderização), então a pessoa nunca chegava a ver nada, só via o
  // scanner sumir e voltar pra tela de trás — exatamente o "muito seco"
  // relatado. Agora quem fecha é o próprio modal, depois de dar tempo de
  // ver o check e o texto.
  useEffect(() => {
    if (status !== "sucesso") return;
    const id = setTimeout(onClose, 1900);
    return () => clearTimeout(id);
  }, [status, onClose]);

  return (
    <Modal open={open} onClose={onClose} title="Confirmar presença">
      <div className="flex flex-col gap-4">
        {status !== "sucesso" && (
          <p className="text-sm text-fatec-muted">
            Aponte a câmera pro QR exibido pela organização no local do evento.
          </p>
        )}

        {status === "sucesso" ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-emerald-50 py-8 text-center">
            <IconeSucesso />
            <p className="text-base font-semibold text-emerald-700">Presença confirmada!</p>
          </div>
        ) : (
          <div id="confirmar-presenca-leitor" className="overflow-hidden rounded-xl" />
        )}

        {status === "enviando" && (
          <p className="text-sm text-fatec-muted">Confirmando...</p>
        )}
        {erro && <p className="text-sm text-rose-600">{erro}</p>}
      </div>
    </Modal>
  );
}
