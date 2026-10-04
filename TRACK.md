# TRACK.md — build log

Read PRD.md first. This file is the running log of what's done, what's next,
and every corner cut (each tagged `ponytail:` in code too).

## Status: MVP complete

## Done

- [x] `create-next-app` scaffold (TS, Tailwind, App Router)
- [x] PRD.md written, scope locked to MVP in §2
- [x] Installed deps: prisma, better-auth, @trpc/*, @tanstack/react-query, socket.io (+client), zod, tsx
- [x] `prisma/schema.prisma` — better-auth tables (User/Session/Account/Verification) + Studio/StudioMember/StudioSession/ChatMessage
- [x] `lib/db.ts` — PrismaClient singleton, custom output path `@/lib/generated/prisma/client`, `{ accelerateUrl }` constructor
- [x] `lib/auth.ts` — better-auth, prismaAdapter (postgresql), email/password + optional Google OAuth, baseURL + secret from env
- [x] `lib/auth-client.ts` — createAuthClient(), signIn/signUp/signOut/useSession
- [x] `app/api/auth/[...all]/route.ts` — better-auth Next.js handler
- [x] `server/trpc.ts` — tRPC init, publicProcedure + protectedProcedure (UNAUTHORIZED guard)
- [x] `server/context.ts` — per-request context: db + session from better-auth
- [x] `server/routers/studio.ts` — list, bySlug, create (slug collision loop), delete
- [x] `server/routers/session.ts` — start (idempotent), end, history, active (public)
- [x] `server/routers/chat.ts` — history (last 200 msgs, public — late-joiner replay)
- [x] `server/_app.ts` — appRouter wiring all three routers
- [x] `app/api/trpc/[trpc]/route.ts` — tRPC catch-all route handler (fixed 404 from flat route)
- [x] `client/trpc.ts` + `client/providers.tsx` — tRPC + TanStack Query provider
- [x] `hooks/use-socket.ts` — Socket.io client hook; passes `auth.userId` in handshake for server-side host verification
- [x] `hooks/use-local-recording.ts` — MediaRecorder on composited canvas, download on stop
- [x] `hooks/use-studio-call.ts` — WebRTC mesh hook: signaling, host controls, screen share (`getDisplayMedia` + replaceTrack + auto-revert on browser stop), chat history replay (seeds from `chat.history` on mount, deduplicates live events), layout sync (ponytail: ~6 peer cap)
- [x] `components/custom/studio-canvas.tsx` — canvas compositor: tileRects (solo/grid/spotlight), hidden video elements per stream, rAF draw loop
- [x] `lib/socket.ts` — Socket.io server: isHost from DB ownership (not client claim), room-leave on re-join, no userId leaked to peers, cross-session signal/control guards, body typeof guard, session existence + endedAt verified on join
- [x] `server.ts` — custom Node server: Next.js + Socket.io on same port, optional HTTPS via `HTTPS=true` env (Next's built-in mkcert)
- [x] `package.json` — `dev` script: `tsx watch server.ts` (not `next dev`)
- [x] `app/globals.css` — brand tokens (`--brand` #1d4ed8, `--brand-light` #3b82f6, `--brand-subtle` #eff6ff) + `.pattern-dots` / `.pattern-diag` utilities (PRD §5, no gradients)
- [x] `.env` — `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `HTTPS` flag, Prisma Postgres `DATABASE_URL`
- [x] `app/page.tsx` — landing page, all links point to `/auth`
- [x] `app/auth/page.tsx` — sign in / sign up (toggle, email+password, better-auth)
- [x] `app/dashboard/page.tsx` — studio list + create + delete; per-studio expandable session history (lazy `session.history` query, shows date/time/duration)
- [x] `app/studio/[slug]/page.tsx` — full studio flow:
  - Green room: getUserMedia, camera preview, name input, invite link copy
  - Live studio: composited canvas, WebRTC mesh, screen share button, record button (download on stop), layout switcher (host), participant list with mute/remove (host), chat (live + history replay), invite link copy, end/leave session

## ⚠️ Run these before `npm run dev`

```bash
npx prisma generate   # rebuilds lib/generated/prisma from schema
npx prisma db push    # creates tables in Prisma Postgres (DATABASE_URL in .env)
```

The generated client lands at `lib/generated/prisma/` — import from there, not `@prisma/client`.

## Next / known gaps

- [ ] `BETTER_AUTH_SECRET` — replace placeholder with `openssl rand -base64 32` before any production deploy
- [ ] Self-check script (`tsx check.ts`) — ponytail rule: slug-collision loop + socket signaling contract smoke test
- [ ] HTTPS for mobile/LAN: set `HTTPS=true` in `.env`, restart. Accept the self-signed cert warning once.

## Known ceilings (see PRD §7)

- Mesh WebRTC → practical cap ~6 participants. `ponytail:` comment in `use-studio-call.ts` marks the SFU swap-in point.
- STUN only, no TURN by default — fails behind strict symmetric NATs. Wire `NEXT_PUBLIC_TURN_URL/USERNAME/CREDENTIAL` in `.env` to add TURN.
- Recording is client-side only (MediaRecorder on canvas) — no server pipeline. Phase 2 item.
- Screen share (`getDisplayMedia`) requires HTTPS on non-localhost origins, same as camera.

## Phase 2 seams (not built — see PRD §2)

- SFU (mediasoup/LiveKit) — replace `useStudioCall`'s peer-per-peer mesh with a single uplink to the SFU
- `Broadcaster` interface — server-side compositor + ffmpeg → RTMP fan-out to YouTube/Twitch/FB
- Cloud recording + VOD storage/transcoding
- Overlays/branding assets, custom layouts, stream destinations UI

## Decisions log

- No Zustand/Redux — TanStack Query + React state is sufficient for this scope (YAGNI)
- Guests join by display name only (no User row) — ephemeral socket identity; `senderId` nullable in `ChatMessage`
- Media never touches Socket.io — signaling + control plane only, media is p2p WebRTC
- DB: `postgresql` via Prisma Postgres (`prisma+postgres://` URL). PRD said SQLite; scaffold used Prisma Postgres — kept, behaviour identical for MVP
- Prisma 8 custom output path (`lib/generated/prisma`) — always import PrismaClient from there, not `@prisma/client`
- Custom server (`server.ts`) co-hosts Next.js + Socket.io on one port — required because Socket.io must attach to the raw `http.Server` before Next.js handles requests
- `isHost` on the socket server is derived from the DB (`studio.ownerId === claimedUserId`), not from the client's `join` payload — client can't promote itself
