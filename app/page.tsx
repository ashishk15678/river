import Link from "next/link";

// Inline SVG icons — no extra dependency.
function VideoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden
    >
      <path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.75-.43L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
        aria-hidden
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "Multi-guest studio",
    desc: "Up to 6 participants in a low-latency mesh. No installs, no extensions.",
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M10 15V9l5 3-5 3Z" />
      </svg>
    ),
    title: "Local recording",
    desc: "Record your composited canvas locally. Download the file — no cloud needed.",
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
        aria-hidden
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18M3 9h6M3 15h6" />
      </svg>
    ),
    title: "Layouts + overlays",
    desc: "Switch grid, spotlight, solo. Add lower-thirds, banners and logo watermarks.",
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
        aria-hidden
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: "Live chat",
    desc: "In-session chat persisted to your account. Late joiners see the history.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      {/* nav */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#09090b]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-blue-600">
              <VideoIcon />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-white">
              OnAir
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/auth"
              className="rounded-lg px-4 py-1.5 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/auth"
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-28 text-center">
        {/* subtle dot-grid texture — no gradient, just the existing utility */}
        <div className="pointer-events-none absolute inset-0 pattern-dots opacity-30" />

        <div className="relative z-10 max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
            <span className="size-1.5 rounded-full bg-blue-400" />
            Live studio · No downloads required
          </div>

          <h1 className="text-5xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
            A broadcast studio
            <br />
            <span className="text-blue-400">right in your browser</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-zinc-400">
            Bring guests in, switch layouts on the fly, overlay lower-thirds and
            banners, and record — all without leaving the tab.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth"
              className="rounded-xl bg-blue-600 px-7 py-3 text-[15px] font-semibold text-white transition hover:bg-blue-500"
            >
              Start for free
            </Link>
            <Link
              href="/auth"
              className="rounded-xl border border-white/[0.12] px-7 py-3 text-[15px] font-medium text-zinc-200 transition hover:bg-white/[0.05]"
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      {/* feature grid */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-24">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5"
            >
              <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-blue-600/15 text-blue-400">
                {f.icon}
              </div>
              <p className="text-[14px] font-semibold text-white">{f.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/[0.06] px-6 py-5 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} OnAir — built with Next.js, mediasoup, tRPC
        and Socket.io
      </footer>
    </div>
  );
}
