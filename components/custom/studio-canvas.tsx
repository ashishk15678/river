"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { RemotePeer } from "@/hooks/use-studio-call";

type Layout = "solo" | "grid" | "spotlight";
type Rect = [number, number, number, number];

interface Tile {
  key: string;
  stream: MediaStream | null;
  label: string;
  isLocal: boolean;
  isScreen: boolean;
}

const W = 1280;
const H = 720;
const GAP = 4;

function tileRects(count: number, layout: Layout): Rect[] {
  if (count === 0) return [];
  if (layout === "solo" || count === 1) return [[0, 0, W, H]];

  if (layout === "spotlight") {
    const mainW = (W * 3) / 4;
    const sideCount = count - 1;
    const sideH = H / sideCount;
    return [
      [0, 0, mainW, H],
      ...Array.from(
        { length: sideCount },
        (_, i): Rect => [mainW, i * sideH, W - mainW, sideH],
      ),
    ];
  }

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cw = W / cols;
  const ch = H / rows;
  return Array.from(
    { length: count },
    (_, i): Rect => [(i % cols) * cw, Math.floor(i / cols) * ch, cw, ch],
  );
}

function drawVideo(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  [x, y, w, h]: Rect,
  fit: "cover" | "contain",
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;

  if (fit === "cover") {
    const scale = Math.max(w / vw, h / vh);
    const sw = w / scale;
    const sh = h / scale;
    ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, x, y, w, h);
  } else {
    const scale = Math.min(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    ctx.drawImage(video, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  return true;
}

export const StudioCanvas = forwardRef<
  HTMLCanvasElement,
  {
    localStream: MediaStream | null;
    localScreen?: MediaStream | null;
    localName: string;
    peers: Record<string, RemotePeer>;
    layout: Layout;
    className?: string;
  }
>(function StudioCanvas(
  { localStream, localScreen = null, localName, peers, layout, className },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement);

  const videos = useRef<Map<string, HTMLVideoElement>>(new Map());
  const tilesRef = useRef<Tile[]>([]);
  const layoutRef = useRef<Layout>(layout);

  // Screens first so spotlight / solo show the shared screen.
  const tiles: Tile[] = [
    ...(localScreen
      ? [{ key: "local:screen", stream: localScreen, label: `${localName} (screen)`, isLocal: true, isScreen: true }]
      : []),
    ...Object.values(peers).flatMap((p) =>
      p.screen
        ? [{ key: `${p.socketId}:screen`, stream: p.screen, label: `${p.name} (screen)`, isLocal: false, isScreen: true }]
        : [],
    ),
    { key: "local", stream: localStream, label: `${localName} (you)`, isLocal: true, isScreen: false },
    ...Object.values(peers).map((p) => ({
      key: p.socketId,
      stream: p.stream,
      label: p.name,
      isLocal: false,
      isScreen: false,
    })),
  ];
  tilesRef.current = tiles;
  layoutRef.current = layout;

  const signature = tiles.map((t) => `${t.key}=${t.stream?.id ?? ""}`).join("|");

  // One off-DOM <video> per tile: gives the canvas decoded frames and plays
  // remote audio (remote videos are unmuted, local ones muted to avoid echo).
  useEffect(() => {
    const live = new Set<string>();
    for (const t of tilesRef.current) {
      live.add(t.key);
      let video = videos.current.get(t.key);
      if (!video) {
        video = document.createElement("video");
        video.playsInline = true;
        videos.current.set(t.key, video);
      }
      video.muted = t.isLocal;
      if (video.srcObject !== t.stream) {
        video.srcObject = t.stream;
        if (t.stream) video.play().catch(() => {});
      }
    }
    for (const [key, video] of videos.current) {
      if (!live.has(key)) {
        video.pause();
        video.srcObject = null;
        videos.current.delete(key);
      }
    }
  }, [signature]);

  useEffect(() => {
    const map = videos.current;
    return () => {
      for (const v of map.values()) {
        v.pause();
        v.srcObject = null;
      }
      map.clear();
    };
  }, []);

  // Draw loop runs once and reads the latest tiles / layout through refs.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = W;
    canvas.height = H;
    let raf = 0;

    const draw = () => {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      const list = tilesRef.current;
      const rects = tileRects(list.length, layoutRef.current);

      list.forEach((t, i) => {
        const r = rects[i];
        if (!r) return;
        const rect: Rect = [r[0] + GAP / 2, r[1] + GAP / 2, r[2] - GAP, r[3] - GAP];
        const [x, y, w, h] = rect;

        ctx.fillStyle = t.isScreen ? "#000000" : "#1e293b";
        ctx.fillRect(x, y, w, h);

        const video = videos.current.get(t.key);
        const hasFrame =
          !!video &&
          video.readyState >= 2 &&
          drawVideo(ctx, video, rect, t.isScreen ? "contain" : "cover");

        if (!hasFrame) {
          const radius = Math.min(w, h) / 6;
          ctx.fillStyle = "#334155";
          ctx.beginPath();
          ctx.arc(x + w / 2, y + h / 2, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#e2e8f0";
          ctx.font = `600 ${Math.round(radius)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText((t.label[0] ?? "?").toUpperCase(), x + w / 2, y + h / 2);
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
        }

        ctx.strokeStyle = "#1d4ed8";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

        ctx.font = "16px sans-serif";
        const textW = ctx.measureText(t.label).width;
        ctx.fillStyle = "rgba(15,23,42,0.7)";
        ctx.fillRect(x + 6, y + h - 32, textW + 16, 24);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(t.label, x + 14, y + h - 14);
      });

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className={className} />;
});
