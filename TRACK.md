# TRACK.md — build log

Read PRD.md first. This file is the running log of what's done, what's next,
and every corner cut (each tagged `ponytail:` in code too).

## Status: in progress

## Done

- [x] `create-next-app` scaffold (TS, Tailwind, App Router)
- [x] PRD.md written, scope locked to MVP in §2
- [x] Installed deps: prisma@8, better-auth, @trpc/*, @tanstack/react-query, socket.io (+client), zod, tsx
- [x] `prisma/schema.prisma` — better-auth tables (User/Session/Account/Verification) + Studio/StudioMember/StudioSession/ChatMessage
- [x] `lib/db.ts` — PrismaClient singleton; import fixed to custom output path `@/lib/generated/prisma/client`; constructor uses `{ accelerateUrl }` (Prisma 8 requires adapter or accelerateUrl — `prisma+postgres://` URLs use accelerateUrl, no extra adapter package needed)
- [x] `lib/auth.ts` — better-auth with prismaAdapter, email/password + optional Google OAuth via env vars
- [x] `lib/auth-client.ts` — createAuthClient(), exports signIn/signUp/signOut/useSession
- [x] `app/api/auth/[...all]/route.ts` — better-auth Next.js handler
- [x] `server/trpc.ts` — tRPC init, publicProcedure + protectedProcedure (UNAUTHORIZED guard)
- [x] `server/context.ts` — per-request context: db + session from better-auth
- [x] `server/routers/studio.ts` — list, bySlug, create (slug collision loop), delete
- [x] `server/routers/session.ts` — start (idempotent), end, history, active (public)
- [x] `server/routers/chat.ts` — history (last 200 msgs, public — late-joiner replay)
- [x] `server/_app.ts` — appRouter wiring all three routers
- [x] `client/trpc.ts` + `client/providers.tsx` — tRPC client + TanStack Query provider
- [x] `hooks/use-socket.ts` — Socket.io client hook
- [x] `hooks/use-local-recording.ts` — MediaRecorder on composited canvas
- [x] `hooks/use-studio-call.ts` — WebRTC mesh hook (ponytail: ~6 peer cap, SFU seam documented)
- [x] `components/custom/studio-canvas.tsx` — studio canvas component

## ⚠️ Run these before `npm run dev`

```
npx prisma generate   # regenerates lib/generated/prisma from schema
npx prisma db push    # pushes schema to Prisma Postgres (DATABASE_URL in .env)
```

Prisma 8 uses the `prisma-client` generator (not the old `prisma-client-js`). The
generated client lands at `lib/generated/prisma/` — import from there, not
`@prisma/client`.

The remaining TypeScript errors (`studio`/`studioSession`/`chatMessage` not on
PrismaClient) are all stale-generated-client artifacts. They disappear after
`prisma generate` rebuilds the client from the new schema.

## Next (in order)

### 1. `server.ts` — custom Node server ← **blocking everything**

`lib/socket.ts` (`attachSocketServer`) is complete. Missing is the entry point
that creates an `http.Server`, hands it to `attachSocketServer`, then forwards
everything else to the Next.js request handler.

```
// rough shape (see PRD §6 + package.json "dev": "tsx watch server.ts")
import { createServer } from "node:http";
import next from "next";
import { attachSocketServer } from "./lib/socket";

const app = next({ dev: process.env.NODE_ENV !== "production" });
await app.prepare();
const handle = app.getRequestHandler();
const server = createServer((req, res) => handle(req, res));
attachSocketServer(server);
server.listen(3000);
```

### 2. Theme tokens in `globals.css`

`globals.css` has the shadcn default (neutral grey) palette. The brand tokens
`--brand`, `--brand-light`, `--brand-subtle` used throughout the existing pages
(`bg-brand`, `border-brand-subtle`, etc.) are **not defined** — every blue class
is currently a no-op. Add to `:root`:

```css
--brand: #1d4ed8; /* blue-700 */
--brand-light: #3b82f6; /* blue-500 */
--brand-subtle: #eff6ff; /* blue-50  */
```

And map them in `@theme inline` so Tailwind picks them up:

```css
--color-brand: var(--brand);
--color-brand-light: var(--brand-light);
--color-brand-subtle: var(--brand-subtle);
```

Also add the `pattern-dots` utility (dot-grid SVG background — PRD §5).

### 3. Fix `/login` → `/auth` in `app/page.tsx`

Landing page links to `/login` but the auth page lives at `/auth`. Three
`href="/login"` refs need changing to `/auth`. One-line fix per occurrence.

### 4. Fix `app/dashboard/studio/page.tsx` — wrong file content

This file contains a copy of the auth page (`LoginPage`), not the studio page.
It should be the live studio room for `studio/[slug]`. The route also needs to
be a dynamic segment: `app/dashboard/studio/[slug]/page.tsx`, not
`app/dashboard/studio/page.tsx`. The current file should be deleted or replaced.

The studio page needs:

- Read `params.slug` → `trpc.studio.bySlug` → get studioId
- `trpc.session.active` to find (or start) the live session
- Green room phase: `getUserMedia` for camera/mic check + display-name input for guests
- Live phase: mount `<StudioCanvas>` + wire `useStudioCall` (socket + WebRTC mesh) + chat panel + host controls
- `useLocalRecording` start/stop/download button

### 5. Green room component

Camera/mic preview before "Go Live". Needed by the studio page above.
Separate component (`components/custom/green-room.tsx`) or inline in the studio
page — whichever is smaller.

### 6. Self-check script (`check.ts` or inline `node -e`)

Per ponytail rule: non-trivial logic needs one runnable check. The socket
signaling event contract and the slug-collision loop are the two candidates.
Minimum: a comment-annotated smoke test that can be run with `tsx check.ts`.

---

**Remaining files to write (net new):**

| File                                   | Status                           |
| -------------------------------------- | -------------------------------- |
| `server.ts`                            | not started                      |
| `globals.css` brand tokens             | not applied                      |
| `app/page.tsx` `/login` → `/auth`      | 3-line fix                       |
| `app/dashboard/studio/[slug]/page.tsx` | wrong file, needs rewrite + move |
| `components/custom/green-room.tsx`     | not started                      |

## Known ceilings (see PRD §7)

- Mesh WebRTC only, no SFU → practical cap ~6 participants (`ponytail:` in use-studio-call.ts)
- STUN only, no TURN by default — fails behind strict symmetric NATs; `NEXT_PUBLIC_TURN_*` env vars wired, unset
- Recording is client-side only (MediaRecorder on canvas) — no server pipeline

## Decisions log

- No Zustand/Redux — TanStack Query + local React state covers this scope (YAGNI)
- Guests join by display name only (no User row) — ephemeral socket identity; senderId nullable in ChatMessage
- Media never touches Socket.io — signaling/control plane only
- DB provider: `postgresql` via Prisma Postgres (`prisma+postgres://` URL). PRD said SQLite but the scaffold used Prisma Postgres; keeping it — no behaviour difference for MVP, and it's what the env already has.
- Prisma 8 custom output path (`lib/generated/prisma`) — import PrismaClient from there, NOT `@prisma/client`
