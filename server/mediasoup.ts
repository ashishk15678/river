import os from "node:os";
import { createWorker } from "mediasoup";
import type { types as ms } from "mediasoup";

// ─── Codecs the router will accept ───────────────────────────────────────────
const mediaCodecs: ms.RouterRtpCodecCapability[] = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: { "x-google-start-bitrate": 1000 },
  },
  {
    kind: "video",
    mimeType: "video/H264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "42e01f",
      "level-asymmetry-allowed": 1,
      "x-google-start-bitrate": 1000,
    },
  },
];

// ─── Worker pool (lazy, round-robin) ─────────────────────────────────────────
const workers: ms.Worker[] = [];
let nextWorker = 0;
let initPromise: Promise<void> | null = null;

async function initWorkers() {
  const count = Math.max(
    1,
    Number(process.env.MEDIASOUP_WORKERS ?? Math.min(os.cpus().length, 4)),
  );

  for (let i = 0; i < count; i++) {
    const worker = await createWorker({
      logLevel: "warn",
      rtcMinPort: Number(process.env.MEDIASOUP_MIN_PORT ?? 40000),
      rtcMaxPort: Number(process.env.MEDIASOUP_MAX_PORT ?? 49999),
    });
    worker.on("died", (err) => {
      // A dead worker takes every room on it down. Let the process
      // supervisor (pm2 / docker / systemd) restart us.
      console.error("[mediasoup] worker died, exiting", err);
      setTimeout(() => process.exit(1), 2000);
    });
    workers.push(worker);
  }
  console.log(`[mediasoup] ${workers.length} worker(s) ready`);
}

export async function createRouter(): Promise<ms.Router> {
  initPromise ??= initWorkers();
  await initPromise;
  const worker = workers[nextWorker++ % workers.length];
  return worker.createRouter({ mediaCodecs });
}

// ─── WebRTC transport ────────────────────────────────────────────────────────
// MEDIASOUP_ANNOUNCED_IP must be the address *browsers* can reach:
//   • local dev on the same machine → 127.0.0.1 (default)
//   • testing from phone / other PC on LAN → your LAN IP
//   • production → the server's public IP
export async function createWebRtcTransport(
  router: ms.Router,
): Promise<ms.WebRtcTransport> {
  const ip = process.env.MEDIASOUP_LISTEN_IP ?? "0.0.0.0";
  const announcedAddress = process.env.MEDIASOUP_ANNOUNCED_IP ?? "127.0.0.1";

  return router.createWebRtcTransport({
    listenInfos: [
      { protocol: "udp", ip, announcedAddress },
      { protocol: "tcp", ip, announcedAddress },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1_000_000,
  });
}
