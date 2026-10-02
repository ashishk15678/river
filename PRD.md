# PRD — "OnAir" (StreamYard-style live studio)

## 1. What we're actually building

StreamYard's full product is: browser-based multi-guest video studio → real-time
compositing (layouts, overlays, branding) → RTMP restreaming to YouTube/Twitch/FB
simultaneously → cloud recording → VOD.

The RTMP-restreaming + server-side compositing piece requires a media server
(mediasoup/LiveKit SFU + ffmpeg pushing RTMP) and real cloud infra (storage,
transcoding workers). That's a separate infra project, not a Next.js feature.

**Decision:** build the real product — the live studio itself — end to end, and
scope multistreaming as a documented Phase 2 behind a clean seam (a `Broadcaster`
interface), rather than faking it or refusing the request. This PRD says exactly
where that seam is.

## 2. Scope

### MVP (what gets built now)

- Email/password + Google auth (better-auth)
- Create/manage **Studios** (a room you own, has a slug, invite links)
- Studio **green room**: camera/mic check before joining
- Live **studio session**: multi-guest WebRTC mesh (up to ~6 participants —
  mesh is fine at that size, SFU only matters past that), host controls
  (mute/remove/promote-to-stage), live layout switching (solo/grid/spotlight),
  in-studio text chat, screen share
- **Local recording**: each participant's tab records its own composited canvas
  output (MediaRecorder) and can download the file — no server transcoding needed
  for MVP
- Studio dashboard: list studios, past sessions, participants

### Phase 2 (documented, not built)

- SFU (mediasoup/LiveKit) once participant count > ~6
- Server-side compositor + ffmpeg → RTMP fan-out to YouTube/Twitch/FB (this is
  the `Broadcaster` interface seam mentioned above)
- Cloud recording + VOD storage/transcoding
- Overlays/branding assets, custom layouts, stream destinations UI

### Explicitly not doing

- Mobile apps
- Payment/billing
- Analytics/dashboards beyond basic session history

## 3. Stack (as requested)

| Concern        | Choice                                        | Why                                                                    |
| -------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| App framework  | Next.js 15 (App Router)                       | requested                                                              |
| DB             | SQLite via Prisma                             | requested; fine for single-node MVP                                    |
| Auth           | better-auth                                   | requested; email/password + OAuth                                      |
| API layer      | tRPC                                          | requested; typesafe RPC for all CRUD (studios, sessions, chat history) |
| Client data    | TanStack Query                                | requested; tRPC's react-query integration                              |
| Realtime       | Socket.io                                     | requested; WebRTC signaling, chat, presence, host-control events       |
| Realtime media | raw WebRTC (RTCPeerConnection), mesh topology | no new dependency needed for ≤6 guests                                 |
| Styling        | Tailwind, white/blue, **no gradients**        | requested — see §5                                                     |

No state library beyond TanStack Query + React state — a Zustand-style client
store isn't needed for this scope (YAGNI).

## 4. Data model (Prisma, SQLite)

- `User`, `Session`, `Account`, `Verification` — owned by better-auth, not
  hand-rolled.
- `Studio` — id, slug, name, ownerId, createdAt
- `StudioMember` — studioId, userId, role (HOST/COGUEST), invited/joined state
- `StudioSession` — a single "on air" run of a studio: id, studioId, startedAt,
  endedAt
- `ChatMessage` — sessionId, senderId or guestName, body, createdAt

Guests without an account can join via invite link with just a display name
(common StreamYard UX) — handled as an ephemeral socket identity, not a User row.

## 5. Visual design

- Primary palette: **white background, blue (`#1d4ed8` / `#3b82f6`) as the
  single accent**. No gradients anywhere.
- Instead of gradients for visual texture: subtle **dot-grid and diagonal-line
  patterns** (SVG background-image, low-opacity blue-on-white) on hero/empty
  states and the green-room backdrop. Solid fills everywhere else.
- "On air" / recording indicators use a solid red dot only where semantically
  required (industry-standard signal) — not part of the primary palette.

## 6. Realtime architecture

- One Socket.io server (custom Next.js server, `server.ts`) namespaced per
  studio session: `/studio/:sessionId`.
- Socket.io responsibilities: WebRTC signaling (offer/answer/ICE relay),
  presence, chat, host-control commands (mute, remove, layout change, promote).
- Socket.io is **not** used to carry media — media is peer-to-peer WebRTC.
  Socket is signaling + control plane only.
- tRPC is used for everything that isn't realtime: auth-adjacent user data,
  studio CRUD, session history, chat history persistence.

## 7. Non-goals / known ceilings (flagged, not hidden)

- Mesh WebRTC caps out around 6 participants (bandwidth on each peer scales
  with participant count). Documented seam to swap in an SFU later.
- No TURN server configured by default (STUN only) — will fail behind strict
  symmetric NATs. `.env` has a slot for `TURN_URL`/`TURN_CREDENTIALS`, wired
  through but unset. Noted in TRACK.md as a ceiling.
- Local (client-side) recording only; no server-side recording pipeline.

## 8. Milestones

1. Scaffold + auth (better-auth) + Prisma schema
2. tRPC routers: studio CRUD, session, chat history
3. Socket.io signaling server + green room + single-peer WebRTC call
4. Multi-guest mesh + host controls + layouts
5. In-studio chat (socket, persisted via tRPC)
6. Local recording (MediaRecorder on composited canvas)
7. Polish: theme, empty states, dashboard
