"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/Modal";

// Mesma proporção do banner de destaque na home/painel do aluno (2026-09-03)
// — enquadrar aqui, na hora do upload, evita a foto "estourada"/cortada de
// jeito estranho quando aparece gigante na tela (object-cover sozinho não
// dava controle nenhum pro admin sobre o que fica visível). Banner virou
// full-bleed (edge a edge, sem card) — output em resolução mais alta que
// antes pra não ficar borrado em monitor grande.
const RATIO_W = 12;
const RATIO_H = 5;
const VIEWPORT_W = 640;
const VIEWPORT_H = Math.round((VIEWPORT_W * RATIO_H) / RATIO_W);
const OUTPUT_W = 1920;
const OUTPUT_H = Math.round((OUTPUT_W * RATIO_H) / RATIO_W);

export function BannerCropModal({
  open,
  arquivo,
  salvando = false,
  onCancel,
  onConfirmar,
}: {
  open: boolean;
  arquivo: File | null;
  // Estado de upload em andamento (2026-09-03, fluxo de trocar banner de um
  // evento já existente é assíncrono) — desabilita o botão e troca o texto
  // pra não deixar clicar duas vezes enquanto sobe pro Storage.
  salvando?: boolean;
  onCancel: () => void;
  onConfirmar: (blob: Blob) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const arrastando = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!arquivo) {
      Promise.resolve().then(() => setImg(null));
      return;
    }
    const url = URL.createObjectURL(arquivo);
    const el = new Image();
    el.onload = () => {
      setImg(el);
      setZoom(1);
    };
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  const baseScale = useMemo(
    () => (img ? Math.max(VIEWPORT_W / img.width, VIEWPORT_H / img.height) : 1),
    [img],
  );

  // Centraliza a imagem no viewport assim que ela carrega ou quando o
  // usuário troca de arquivo — sem isso o primeiro frame nasce com offset
  // (0,0), quase sempre cortando o topo/esquerda da foto sem necessidade.
  useEffect(() => {
    if (!img) return;
    const displayScale = baseScale;
    const w = img.width * displayScale;
    const h = img.height * displayScale;
    Promise.resolve().then(() =>
      setOffset({ x: (VIEWPORT_W - w) / 2, y: (VIEWPORT_H - h) / 2 }),
    );
  }, [img, baseScale]);

  function clamp(valor: { x: number; y: number }, escala: number) {
    if (!img) return valor;
    const w = img.width * escala;
    const h = img.height * escala;
    return {
      x: Math.min(0, Math.max(VIEWPORT_W - w, valor.x)),
      y: Math.min(0, Math.max(VIEWPORT_H - h, valor.y)),
    };
  }

  function mudarZoom(novoZoom: number) {
    if (!img) return;
    const escalaAntiga = baseScale * zoom;
    const escalaNova = baseScale * novoZoom;
    // Mantém o ponto que está no centro do viewport fixo ao trocar o zoom
    // (em vez de sempre "puxar" pro canto superior esquerdo).
    const pontoImgX = (VIEWPORT_W / 2 - offset.x) / escalaAntiga;
    const pontoImgY = (VIEWPORT_H / 2 - offset.y) / escalaAntiga;
    const novoOffset = {
      x: VIEWPORT_W / 2 - pontoImgX * escalaNova,
      y: VIEWPORT_H / 2 - pontoImgY * escalaNova,
    };
    setZoom(novoZoom);
    setOffset(clamp(novoOffset, escalaNova));
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastando.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!arrastando.current) return;
    const escala = baseScale * zoom;
    setOffset(
      clamp(
        { x: e.clientX - arrastando.current.x, y: e.clientY - arrastando.current.y },
        escala,
      ),
    );
  }

  function onPointerUp() {
    arrastando.current = null;
  }

  function confirmar() {
    if (!img || !canvasRef.current) return;
    const escala = baseScale * zoom;
    const sx = -offset.x / escala;
    const sy = -offset.y / escala;
    const sw = VIEWPORT_W / escala;
    const sh = VIEWPORT_H / escala;

    const canvas = canvasRef.current;
    canvas.width = OUTPUT_W;
    canvas.height = OUTPUT_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT_W, OUTPUT_H);
    canvas.toBlob(
      (blob) => {
        if (blob) onConfirmar(blob);
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <Modal open={open} onClose={onCancel} title="Ajustar banner do evento">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fatec-muted">
          Arraste a foto pra posicionar e use o controle de zoom pra ajustar
          — a área visível dentro da moldura é exatamente o que vai aparecer
          no banner de destaque.
        </p>

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="relative mx-auto touch-none select-none overflow-hidden rounded-xl border border-fatec-line bg-fatec-navy-900"
          style={{ width: VIEWPORT_W, height: VIEWPORT_H, maxWidth: "100%" }}
        >
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-0 top-0 max-w-none"
              style={{
                width: img.width * baseScale * zoom,
                height: img.height * baseScale * zoom,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
        </div>

        <label className="flex items-center gap-3">
          <span className="text-xs font-medium text-fatec-navy-900">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => mudarZoom(Number(e.target.value))}
            className="flex-1 accent-fatec-orange-500"
          />
        </label>

        <canvas ref={canvasRef} className="hidden" />

        <div className="flex justify-end gap-2 border-t border-fatec-line pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={salvando}
            className="rounded-xl border border-fatec-line px-5 py-2.5 text-sm font-semibold text-fatec-navy-900 transition-colors hover:bg-fatec-navy-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!img || salvando}
            className="rounded-xl bg-fatec-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fatec-orange-500/25 transition-colors hover:bg-fatec-orange-600 disabled:cursor-not-allowed disabled:bg-fatec-navy-100 disabled:text-fatec-muted disabled:shadow-none"
          >
            {salvando ? "Salvando..." : "Usar essa foto"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
