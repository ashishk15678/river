"use client";

import { use, useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/client/trpc";
import { useSession } from "@/lib/auth-client";
import { useSocket } from "@/hooks/use-socket";
import { useStudioCall } from "@/hooks/use-studio-call";
import { useLocalRecording } from "@/hooks/use-local-recording";
import { StudioCanvas } from "@/components/custom/studio-canvas";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return (
    <button
      onClick={copy}
      className="shrink-0 rounded-md border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

function GreenRoom({
  studioName,
  studioSlug,
  defaultName,
  onJoin,
}: {
  studioName: string;
  studioSlug: string;
  defaultName: string;
  onJoin: (name: string, stream: MediaStream) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camErr, setCamErr] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/studio/${studioSlug}`
      : "";

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamErr(
        "Camera access requires a secure connection (HTTPS). " +
          "Open this page via localhost, or use the HTTPS dev server.",
      );
      return;
    }
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((s) => {
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch((e) => setCamErr(e.message ?? "Camera/mic access denied"));
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-12 bg-[#09090b]">
      <div className="text-center">
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-zinc-500">
          Green room
        </p>
        <h1 className="text-2xl font-bold text-white">{studioName}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Check your camera and mic, then join when ready
        </p>
      </div>

      {/* Camera preview */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-zinc-900 aspect-video ring-1 ring-white/[0.07]">
        {camErr ? (
          <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-red-400">
            {camErr}
          </div>
        ) : (
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        )}
        {/* camera indicator dot */}
        {!camErr && (
          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs text-zinc-300 backdrop-blur-sm">
            <span
              className={`size-1.5 rounded-full ${stream ? "bg-green-400" : "bg-yellow-400 animate-pulse"}`}
            />
            {stream ? "Camera ready" : "Starting…"}
          </div>
        )}
      </div>

      <div className="w-full max-w-sm space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="h-10 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500/60 focus:outline-none"
        />
        <button
          onClick={() => {
            if (stream && name.trim()) onJoin(name.trim(), stream);
          }}
          disabled={!stream || !name.trim()}
          className="h-10 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {stream ? "Join studio" : "Waiting for camera…"}
        </button>

        {/* Invite link */}
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
          <span className="flex-1 truncate text-xs text-zinc-500">
            {inviteUrl}
          </span>
          <CopyButton text={inviteUrl} label="Copy invite" />
        </div>
      </div>
    </main>
  );
}

// ─── Live studio ─────────────────────────────────────────────────────────────

function LiveStudio({
  sessionId,
  studioName,
  studioSlug,
  localStream,
  displayName,
  userId,
  isHost,
  onEnd,
}: {
  sessionId: string;
  studioName: string;
  studioSlug: string;
  localStream: MediaStream;
  displayName: string;
  userId: string | null;
  isHost: boolean;
  onEnd: () => void;
}) {
  const socket = useSocket(userId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [chatInput, setChatInput] = useState("");
  const [activePanel, setActivePanel] = useState<
    "participants" | "chat" | "overlays"
  >("chat");
  // Local overlay editor state (host only) — synced to room via setOverlays
  const [localOverlays, setLocalOverlays] = useState<
    import("@/hooks/use-studio-call").Overlay[]
  >([]);
  const [newLtTitle, setNewLtTitle] = useState("");
  const [newLtSub, setNewLtSub] = useState("");
  const [newLtTarget, setNewLtTarget] = useState("local");
  const [bannerText, setBannerText] = useState("");
  const [logoPos, setLogoPos] = useState<"tl" | "tr" | "bl" | "br">("br");

  const {
    recording,
    start: startRec,
    stop: stopRec,
    download,
  } = useLocalRecording();

  const {
    peers,
    messages,
    layout,
    localScreen,
    screensharing,
    spotlight,
    raisedHands,
    overlays,
    shareScreen,
    sendChat,
    setHostLayout,
    muteTarget,
    removeTarget,
    stopCamTarget,
    setSpotlightTarget,
    setOverlays,
    raiseHand,
    lowerHand,
  } = useStudioCall({
    socket,
    sessionId,
    localStream,
    name: displayName,
    onRemoved: onEnd,
  });

  const endSession = trpc.session.end.useMutation({ onSuccess: onEnd });

  // Keep local overlay state in sync with what the room sees
  useEffect(() => {
    setLocalOverlays(overlays);
  }, [overlays]);

  const pushOverlays = useCallback(
    (next: import("@/hooks/use-studio-call").Overlay[]) => {
      setLocalOverlays(next);
      setOverlays(next);
    },
    [setOverlays],
  );

  const handleRecord = useCallback(async () => {
    if (recording) {
      const blob = await stopRec();
      download(blob);
    } else {
      if (canvasRef.current) startRec(canvasRef.current, localStream);
    }
  }, [recording, startRec, stopRec, download, localStream]);

  const addOverlay = useCallback(
    (ov: import("@/hooks/use-studio-call").Overlay) => {
      pushOverlays([
        ...localOverlays.filter((o) => o.kind !== ov.kind || o.id !== ov.id),
        ov,
      ]);
    },
    [localOverlays, pushOverlays],
  );

  const removeOverlay = useCallback(
    (id: string) => {
      pushOverlays(localOverlays.filter((o) => o.id !== id));
    },
    [localOverlays, pushOverlays],
  );

  const toggleOnAir = useCallback(() => {
    const has = localOverlays.some((o) => o.kind === "onair");
    if (has) pushOverlays(localOverlays.filter((o) => o.kind !== "onair"));
    else pushOverlays([...localOverlays, { id: "onair", kind: "onair" }]);
  }, [localOverlays, pushOverlays]);

  const handleLogo = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        pushOverlays([
          ...localOverlays.filter((o) => o.kind !== "logo"),
          { id: "logo", kind: "logo", dataUrl, position: logoPos },
        ]);
      };
      reader.readAsDataURL(file);
    },
    [localOverlays, pushOverlays, logoPos],
  );

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/studio/${studioSlug}`
      : "";

  const hasOnAir = localOverlays.some((o) => o.kind === "onair");
  const hasBanner = localOverlays.some((o) => o.kind === "banner");
  const hasLogo = localOverlays.some((o) => o.kind === "logo");
  const myRaisedHand = raisedHands.has(socket.id ?? "");

  const allParticipants = [
    { socketId: "local", name: `${displayName} (you)`, isHost, isLocal: true },
    ...Object.values(peers).map((p) => ({ ...p, isLocal: false })),
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#09090b]">
      {/* ── top bar ─────────────────────────────────────────────────────── */}
      <header className="border-b border-white/[0.07] px-3 h-11 flex items-center gap-2 shrink-0">
        <span className="font-semibold text-white truncate mr-1 text-sm">
          {studioName}
        </span>

        {hasOnAir && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
            <span className="size-1.5 rounded-full bg-white animate-pulse" />
            ON AIR
          </span>
        )}

        <CopyButton text={inviteUrl} label="Invite" />

        {/* Layout switcher — host only */}
        {isHost && (
          <div className="flex gap-1">
            {(["grid", "spotlight", "solo"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setHostLayout(l)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                  layout === l
                    ? "bg-blue-600 text-white"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-1.5 ml-auto flex-wrap">
          {!isHost && (
            <button
              onClick={myRaisedHand ? lowerHand : raiseHand}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                myRaisedHand
                  ? "bg-yellow-500/20 text-yellow-300"
                  : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {myRaisedHand ? "✋ Lower hand" : "✋ Raise hand"}
            </button>
          )}

          <button
            onClick={shareScreen}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
              screensharing
                ? "bg-blue-600 text-white"
                : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            {screensharing ? "Stop sharing" : "Share screen"}
          </button>

          <button
            onClick={handleRecord}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition ${
              recording
                ? "bg-red-600 text-white hover:bg-red-500"
                : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${recording ? "bg-white animate-pulse" : "bg-red-500"}`}
            />
            {recording ? "Stop · Save" : "Record"}
          </button>

          {isHost && (
            <button
              onClick={() => endSession.mutate({ sessionId })}
              className="px-2.5 py-1 rounded text-[11px] font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition"
            >
              End session
            </button>
          )}
          {!isHost && (
            <button
              onClick={onEnd}
              className="px-2.5 py-1 rounded text-[11px] font-medium text-zinc-500 hover:text-zinc-200 transition"
            >
              Leave
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* ── canvas ──────────────────────────────────────────────────────── */}
        <div className="flex-1 bg-zinc-950 relative min-w-0">
          <StudioCanvas
            ref={canvasRef}
            localStream={localStream}
            localScreen={localScreen}
            localName={displayName}
            peers={peers}
            layout={layout}
            spotlight={spotlight}
            raisedHands={raisedHands}
            overlays={localOverlays}
            className="w-full h-full object-contain"
          />
        </div>

        {/* ── sidebar ─────────────────────────────────────────────────────── */}
        <aside className="w-[260px] border-l border-white/[0.07] flex flex-col shrink-0 bg-[#0c0c0e]">
          {/* Panel tabs */}
          <div className="flex border-b border-white/[0.07] shrink-0">
            {(
              ["participants", "chat", ...(isHost ? ["overlays"] : [])] as const
            ).map((p) => (
              <button
                key={p}
                onClick={() => setActivePanel(p as typeof activePanel)}
                className={`flex-1 py-2.5 text-[11px] font-medium capitalize transition ${
                  activePanel === p
                    ? "border-b-2 border-blue-500 text-blue-400"
                    : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* ── Participants panel ─────────────────────────────────────── */}
          {activePanel === "participants" && (
            <div className="flex-1 overflow-y-auto">
              <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                In studio · {allParticipants.length}
              </p>
              <ul className="space-y-px px-2 pb-2">
                {allParticipants.map((p) => (
                  <li
                    key={p.socketId}
                    className="rounded-lg px-2 py-2 hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[11px] font-semibold text-zinc-300">
                        {(p.name[0] ?? "?").toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] text-zinc-200">
                          {p.name}
                          {p.isHost && (
                            <span className="ml-1.5 text-[10px] text-blue-400">
                              host
                            </span>
                          )}
                        </p>
                        {raisedHands.has(p.socketId) && (
                          <p className="text-[10px] text-yellow-400">
                            ✋ raised hand
                          </p>
                        )}
                      </div>
                    </div>
                    {isHost && !p.isLocal && (
                      <div className="mt-1.5 flex gap-1 pl-9">
                        <button
                          onClick={() => muteTarget(p.socketId)}
                          className="rounded px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200"
                        >
                          Mute
                        </button>
                        <button
                          onClick={() => stopCamTarget(p.socketId)}
                          className="rounded px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200"
                        >
                          Cam off
                        </button>
                        <button
                          onClick={() =>
                            setSpotlightTarget(
                              spotlight === p.socketId ? null : p.socketId,
                            )
                          }
                          className={`rounded px-2 py-0.5 text-[10px] ${
                            spotlight === p.socketId
                              ? "bg-yellow-500/20 text-yellow-300"
                              : "text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200"
                          }`}
                        >
                          {spotlight === p.socketId ? "★ Spotlit" : "Spotlight"}
                        </button>
                        <button
                          onClick={() => removeTarget(p.socketId)}
                          className="rounded px-2 py-0.5 text-[10px] text-red-500 hover:bg-red-500/10 hover:text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Chat panel ────────────────────────────────────────────── */}
          {activePanel === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
                {messages.length === 0 && (
                  <p className="mt-6 text-center text-xs text-zinc-600">
                    No messages yet
                  </p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className="text-sm leading-snug">
                    <span className="font-semibold text-blue-400">
                      {m.senderName}{" "}
                    </span>
                    <span className="text-zinc-300">{m.body}</span>
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (chatInput.trim()) {
                    sendChat(chatInput.trim());
                    setChatInput("");
                  }
                }}
                className="border-t border-white/[0.07] px-2 py-2 flex gap-1.5 shrink-0"
              >
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Message…"
                  className="h-8 flex-1 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-blue-500/60 focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-8 w-8 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-500 text-sm"
                >
                  →
                </button>
              </form>
            </>
          )}

          {/* ── Overlays panel (host only) ─────────────────────────── */}
          {activePanel === "overlays" && isHost && (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  On Air
                </p>
                <button
                  onClick={toggleOnAir}
                  className={`w-full rounded-lg py-2 text-xs font-medium transition ${
                    hasOnAir
                      ? "bg-red-600 text-white hover:bg-red-500"
                      : "border border-white/[0.1] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05]"
                  }`}
                >
                  {hasOnAir ? "● Remove On Air" : "Add On Air indicator"}
                </button>
              </section>

              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  Lower thirds
                </p>
                <div className="space-y-1.5">
                  <select
                    value={newLtTarget}
                    onChange={(e) => setNewLtTarget(e.target.value)}
                    className="h-8 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-2 text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value="local">{displayName} (you)</option>
                    {Object.values(peers).map((p) => (
                      <option key={p.socketId} value={p.socketId}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={newLtTitle}
                    onChange={(e) => setNewLtTitle(e.target.value)}
                    placeholder="Name / title"
                    className="h-8 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                  />
                  <input
                    value={newLtSub}
                    onChange={(e) => setNewLtSub(e.target.value)}
                    placeholder="Role / company"
                    className="h-8 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                  />
                  <button
                    disabled={!newLtTitle.trim()}
                    onClick={() => {
                      const id = `lt-${newLtTarget}`;
                      addOverlay({
                        id,
                        kind: "lower-third",
                        socketId: newLtTarget,
                        title: newLtTitle.trim(),
                        subtitle: newLtSub.trim(),
                      });
                      setNewLtTitle("");
                      setNewLtSub("");
                    }}
                    className="h-8 w-full rounded-lg bg-blue-600 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    Add lower third
                  </button>
                  {localOverlays
                    .filter((o) => o.kind === "lower-third")
                    .map((o) => {
                      if (o.kind !== "lower-third") return null;
                      return (
                        <div
                          key={o.id}
                          className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5"
                        >
                          <span className="truncate text-xs text-zinc-300">
                            {o.title}
                          </span>
                          <button
                            onClick={() => removeOverlay(o.id)}
                            className="ml-2 shrink-0 text-zinc-500 hover:text-red-400 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                </div>
              </section>

              {/* Banner ticker */}
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  Banner text
                </p>
                <div className="space-y-1.5">
                  <input
                    value={bannerText}
                    onChange={(e) => setBannerText(e.target.value)}
                    placeholder="Breaking: your text here…"
                    className="h-8 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                  />
                  <div className="flex gap-1.5">
                    <button
                      disabled={!bannerText.trim()}
                      onClick={() =>
                        addOverlay({
                          id: "banner",
                          kind: "banner",
                          text: bannerText.trim(),
                        })
                      }
                      className="h-8 flex-1 rounded-lg bg-blue-600 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      {hasBanner ? "Update" : "Add"} banner
                    </button>
                    {hasBanner && (
                      <button
                        onClick={() => removeOverlay("banner")}
                        className="h-8 rounded-lg border border-red-500/20 bg-red-500/10 px-3 text-xs text-red-400 hover:bg-red-500/15"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {/* Logo watermark */}
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  Logo watermark
                </p>
                <div className="space-y-1.5">
                  <select
                    value={logoPos}
                    onChange={(e) =>
                      setLogoPos(e.target.value as typeof logoPos)
                    }
                    className="h-8 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-2 text-xs text-zinc-200 focus:outline-none"
                  >
                    <option value="tl">Top left</option>
                    <option value="tr">Top right</option>
                    <option value="bl">Bottom left</option>
                    <option value="br">Bottom right</option>
                  </select>
                  <label className="flex h-8 w-full cursor-pointer items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.02] text-xs font-medium text-zinc-300 hover:bg-white/[0.05]">
                    {hasLogo ? "Replace logo" : "Upload logo (PNG/SVG)"}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleLogo}
                    />
                  </label>
                  {hasLogo && (
                    <button
                      onClick={() => removeOverlay("logo")}
                      className="h-8 w-full rounded-lg border border-red-500/20 bg-red-500/10 text-xs text-red-400 hover:bg-red-500/15"
                    >
                      Remove logo
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── Page shell ──────────────────────────────────────────────────────────────

type Phase =
  | { name: "loading" }
  | { name: "greenroom" }
  | { name: "no_session" }
  | {
      name: "live";
      sessionId: string;
      localStream: MediaStream;
      displayName: string;
    };

export default function StudioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { data: session, isPending: authPending } = useSession();

  const studio = trpc.studio.bySlug.useQuery({ slug });
  const startSession = trpc.session.start.useMutation();

  const activeSession = trpc.session.active.useQuery(
    { studioId: studio.data?.id ?? "" },
    {
      enabled: !!studio.data && session?.user?.id !== studio.data.ownerId,
    },
  );

  const [phase, setPhase] = useState<Phase>({ name: "loading" });

  useEffect(() => {
    if (authPending || studio.isPending) return;
    if (phase.name === "loading") setPhase({ name: "greenroom" });
  }, [authPending, studio.isPending, phase.name]);

  const handleJoin = useCallback(
    async (displayName: string, localStream: MediaStream) => {
      if (!studio.data) return;
      const isOwner = session?.user?.id === studio.data.ownerId;
      let sessionId: string;

      if (isOwner) {
        const s = await startSession.mutateAsync({
          studioId: studio.data.id,
        });
        sessionId = s.id;
      } else {
        // Always refetch so "Try again" after no_session gets fresh data,
        // not the stale result from before the host started the session.
        const { data: fresh } = await activeSession.refetch();
        if (!fresh) {
          setPhase({ name: "no_session" });
          return;
        }
        sessionId = fresh.id;
      }

      setPhase({ name: "live", sessionId, localStream, displayName });
    },
    [session, studio.data, startSession, activeSession.data],
  );

  const handleEnd = useCallback(() => router.push("/dashboard"), [router]);

  if (studio.error) {
    return (
      <main className="flex-1 flex items-center justify-center bg-[#09090b] text-zinc-500 text-sm">
        Studio not found.
      </main>
    );
  }

  if (phase.name === "loading" || studio.isPending) {
    return (
      <main className="flex-1 flex items-center justify-center bg-[#09090b]">
        <div className="flex items-center gap-3 text-zinc-500 text-sm">
          <svg
            className="size-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Loading studio…
        </div>
      </main>
    );
  }

  if (phase.name === "no_session") {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#09090b]">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center max-w-xs">
          <div className="mb-3 flex justify-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-zinc-800">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-6 text-zinc-400"
                aria-hidden
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
          </div>
          <p className="text-sm font-medium text-white">Session not started</p>
          <p className="mt-1 text-xs text-zinc-500">
            The host hasn&apos;t gone live yet.
          </p>
          <button
            onClick={() => setPhase({ name: "greenroom" })}
            className="mt-4 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  const studioData = studio.data!;
  const isHost = session?.user?.id === studioData.ownerId;

  if (phase.name === "greenroom") {
    return (
      <GreenRoom
        studioName={studioData.name}
        studioSlug={studioData.slug}
        defaultName={session?.user?.name ?? ""}
        onJoin={handleJoin}
      />
    );
  }

  return (
    <LiveStudio
      sessionId={phase.sessionId}
      studioName={studioData.name}
      studioSlug={studioData.slug}
      localStream={phase.localStream}
      displayName={phase.displayName}
      userId={session?.user?.id ?? null}
      isHost={isHost}
      onEnd={handleEnd}
    />
  );
}
