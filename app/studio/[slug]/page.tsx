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
      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-brand-subtle text-brand hover:bg-blue-100 shrink-0"
    >
      {copied ? "✓ Copied!" : label}
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
    <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">{studioName}</h1>
      <p className="text-slate-500 text-sm">
        Check your camera and mic before joining
      </p>

      <div className="w-full max-w-sm aspect-video bg-slate-900 rounded-lg overflow-hidden">
        {camErr ? (
          <div className="w-full h-full flex items-center justify-center text-red-400 text-sm px-4 text-center">
            {camErr}
          </div>
        ) : (
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="w-full max-w-sm space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full border border-brand-subtle rounded-md px-3 py-2 text-sm"
        />
        <button
          onClick={() => {
            if (stream && name.trim()) onJoin(name.trim(), stream);
          }}
          disabled={!stream || !name.trim()}
          className="w-full bg-brand text-white rounded-md py-2 text-sm font-medium hover:bg-brand-light disabled:opacity-50"
        >
          {stream ? "Join studio" : "Waiting for camera…"}
        </button>

        {/* Invite link */}
        <div className="flex items-center gap-2 rounded-md border border-brand-subtle bg-brand-subtle/40 px-3 py-2">
          <span className="flex-1 text-xs text-slate-500 truncate">
            {inviteUrl}
          </span>
          <CopyButton text={inviteUrl} label="Copy invite link" />
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
    screensharing,
    shareScreen,
    sendChat,
    setHostLayout,
    muteTarget,
    removeTarget,
  } = useStudioCall({
    socket,
    sessionId,
    localStream,
    name: displayName,
    userId,
    isHost,
  });

  const endSession = trpc.session.end.useMutation({ onSuccess: onEnd });

  const handleRecord = useCallback(async () => {
    if (recording) {
      const blob = await stopRec();
      download(blob);
    } else {
      if (canvasRef.current) startRec(canvasRef.current, localStream);
    }
  }, [recording, startRec, stopRec, download, localStream]);

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/studio/${studioSlug}`
      : "";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="border-b border-brand-subtle px-4 py-2 flex items-center gap-2 shrink-0 flex-wrap">
        <span className="font-semibold text-brand truncate mr-1">
          {studioName}
        </span>

        <CopyButton text={inviteUrl} label="Invite" />

        {/* Layout switcher — host only */}
        {isHost && (
          <div className="flex gap-1 ml-1">
            {(["grid", "spotlight", "solo"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setHostLayout(l)}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  layout === l
                    ? "bg-brand text-white"
                    : "bg-brand-subtle text-brand hover:bg-blue-100"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        {/* Right-side controls */}
        <div className="flex gap-2 ml-auto flex-wrap">
          <button
            onClick={shareScreen}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium ${
              screensharing
                ? "bg-brand text-white hover:bg-brand-light"
                : "bg-brand-subtle text-brand hover:bg-blue-100"
            }`}
          >
            {screensharing ? "Stop sharing" : "Share screen"}
          </button>

          {/* Record */}
          <button
            onClick={handleRecord}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium ${
              recording
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-brand-subtle text-brand hover:bg-blue-100"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${recording ? "bg-white" : "bg-red-600"}`}
            />
            {recording ? "Stop · download" : "Record"}
          </button>

          {isHost && (
            <button
              onClick={() => endSession.mutate({ sessionId })}
              className="px-3 py-1.5 rounded text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100"
            >
              End session
            </button>
          )}

          {!isHost && (
            <button
              onClick={onEnd}
              className="px-3 py-1.5 rounded text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Leave
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* ── canvas ──────────────────────────────────────────────────────── */}
        <div className="flex-1 bg-slate-900 relative">
          <canvas ref={canvasRef} className="w-full h-full object-contain" />
          <StudioCanvas
            ref={canvasRef}
            localStream={localStream}
            localName={displayName}
            peers={peers}
            layout={layout}
          />
        </div>

        {/* ── sidebar ─────────────────────────────────────────────────────── */}
        <aside className="w-64 border-l border-brand-subtle flex flex-col shrink-0">
          {/* Participants */}
          <div className="border-b border-brand-subtle px-3 py-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              In studio ({Object.keys(peers).length + 1})
            </p>
            <ul className="space-y-1">
              <li className="text-sm">
                {displayName}{" "}
                <span className="text-xs text-slate-400">(you)</span>
              </li>
              {Object.values(peers).map((p) => (
                <li
                  key={p.socketId}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {p.name}
                    {p.isHost && (
                      <span className="ml-1 text-xs text-brand">host</span>
                    )}
                  </span>
                  {isHost && (
                    <span className="flex gap-1">
                      <button
                        onClick={() => muteTarget(p.socketId)}
                        className="text-xs text-slate-400 hover:text-slate-700"
                      >
                        mute
                      </button>
                      <button
                        onClick={() => removeTarget(p.socketId)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        remove
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
            {messages.map((m) => (
              <div key={m.id} className="text-sm">
                <span className="font-medium text-brand">{m.senderName}: </span>
                <span className="text-slate-700">{m.body}</span>
              </div>
            ))}
          </div>

          {/* Chat input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (chatInput.trim()) {
                sendChat(chatInput.trim());
                setChatInput("");
              }
            }}
            className="border-t border-brand-subtle px-2 py-2 flex gap-1"
          >
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Message…"
              className="flex-1 border border-brand-subtle rounded px-2 py-1 text-sm"
            />
            <button
              type="submit"
              className="px-2 py-1 rounded bg-brand text-white text-sm hover:bg-brand-light"
            >
              →
            </button>
          </form>
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
      <main className="flex-1 flex items-center justify-center text-slate-500">
        Studio not found.
      </main>
    );
  }

  if (phase.name === "loading" || studio.isPending) {
    return (
      <main className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Loading…
      </main>
    );
  }

  if (phase.name === "no_session") {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
        <p>The host hasn&apos;t started the session yet.</p>
        <button
          onClick={() => setPhase({ name: "greenroom" })}
          className="px-4 py-2 rounded bg-brand-subtle text-brand text-sm hover:bg-blue-100"
        >
          Try again
        </button>
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
