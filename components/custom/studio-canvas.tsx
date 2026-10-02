"use client";

import { forwardRef, useEffect, useRef } from "react";
import type { RemotePeer } from "@/hooks/use-studio-call";

interface Tile {
  stream: MediaStream | null;
  label: string;
}

const W = 1280;
const H = 720;

function tileRects(
  count: number,
  layout: "solo" | "grid" | "spotlight",
): [number, number, number, number][] {
  if (count === 0) return [];
  if (layout === "solo" || count === 1) return [[0, 0, W, H]];

  if (layout === "spotlight") {
    const main: [number, number, number, number] = [0, 0, (W * 3) / 4, H];
    const sideCount = count - 1;
    const sideH = H / Math.max(sideCount, 1);
    const rest: [number, number, number, number][] = Array.from(
      { length: sideCount },
      (_, i) => [(W * 3) / 4, i * sideH, W / 4, sideH],
    );
    return [main, ...rest];
  }

  // grid
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cw = W / cols;
  const ch = H / rows;
  return Array.from({ length: count }, (_, i) => [
    (i % cols) * cw,
    Math.floor(i / cols) * ch,
    cw,
    ch,
  ]);
}

export const StudioCanvas = forwardRef<
  HTMLCanvasElement,
  {
    localStream: MediaStream | null;
    localName: string;
    peers: Record<string, RemotePeer>;
    layout: "solo" | "grid" | "spotlight";
  }
>(function StudioCanvas({ localStream, localName, peers, layout }, canvasRef) {
  const videosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const rafRef = useRef<number>(0);

  const tiles: Tile[] = [
    { stream: localStream, label: `${localName} (you)` },
    ...Object.values(peers).map((p) => ({
      stream: p.stream ?? null,
      label: p.name,
    })),
  ];

  // Keep one hidden <video> per tile so the canvas has a decoded frame source.
  useEffect(() => {
    tiles.forEach((t, i) => {
      const key = String(i);
      let video = videosRef.current.get(key);
      if (!video) {
        video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        videosRef.current.set(key, video);
      }
      if (t.stream && video.srcObject !== t.stream) {
        video.srcObject = t.stream;
        video.play().catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream, Object.keys(peers).join(",")]);

  useEffect(() => {
    const canvas = (canvasRef as React.RefObject<HTMLCanvasElement>).current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = W;
    canvas.height = H;

    const draw = () => {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      const rects = tileRects(tiles.length, layout);
      tiles.forEach((t, i) => {
        const rect = rects[i];
        if (!rect) return;
        const [x, y, w, h] = rect;
        const video = videosRef.current.get(String(i));
        if (video && video.readyState >= 2) {
          ctx.drawImage(video, x, y, w, h);
        } else {
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(x, y, w, h);
        }
        ctx.strokeStyle = "#1d4ed8";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
        ctx.fillStyle = "#ffffff";
        ctx.font = "16px sans-serif";
        ctx.fillText(t.label, x + 10, y + h - 12);
      });

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(rafRef.current);
  }, [tiles.length, layout, canvasRef]);

  return null;
});
