"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/client/trpc";
import { useSession, signOut } from "@/lib/auth-client";

const APP_NAME = "Acme Inc.";

// ─── Icons (inline, lucide-style, no extra dependency) ──────────────────────
const ICONS: Record<string, ReactNode> = {
  brand: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m16 12-4-4-4 4" />
      <path d="M12 16V8" />
    </>
  ),
  plus: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </>
  ),
  mail: (
    <>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  dashboard: (
    <>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </>
  ),
  list: (
    <>
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
      <path d="M8 6h13M8 12h13M8 18h13" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9M13 17V5M8 17v-3" />
    </>
  ),
  folder: (
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  video: (
    <>
      <path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.75-.43L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </>
  ),
  more: (
    <>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </>
  ),
  panel: (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
    </>
  ),
  up: (
    <>
      <path d="M16 7h6v6" />
      <path d="m22 7-8.5 8.5-5-5L2 17" />
    </>
  ),
  down: (
    <>
      <path d="M16 17h6v-6" />
      <path d="m22 17-8.5-8.5-5 5L2 7" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </>
  ),
};

function Icon({
  name,
  className = "size-4",
}: {
  name: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

const NAV = [
  { label: "Dashboard", icon: "dashboard", active: true },
  { label: "Lifecycle", icon: "list" },
  { label: "Analytics", icon: "chart" },
  { label: "Projects", icon: "folder" },
  { label: "Team", icon: "users" },
];

type Studio = {
  id: string;
  name: string;
  slug: string;
  _count: { sessions: number };
};

function Sidebar({
  open,
  studios,
  userName,
  userEmail,
  onQuickCreate,
  onLogout,
}: {
  open: boolean;
  studios: Studio[];
  userName: string;
  userEmail: string;
  onQuickCreate: () => void;
  onLogout: () => void;
}) {
  return (
    <aside
      className={`shrink-0 overflow-hidden border-white/[0.07] bg-[#0c0c0e] transition-[width] duration-200 ${
        open ? "w-53 border-r" : "w-0"
      }`}
    >
      <div className="flex h-full w-[195px] flex-col px-2 py-2.5">
        {/* brand */}
        <div className="flex items-center gap-2 px-2 py-1.5 text-[13px] font-semibold text-white">
          <Icon name="brand" className="size-[18px]" />
          {APP_NAME}
        </div>

        {/* quick create */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onQuickCreate}
            className="flex h-9 flex-1 items-center gap-2 rounded-lg bg-zinc-100 px-3 text-[13px] font-medium text-zinc-900 transition-colors hover:bg-white"
          >
            <Icon name="plus" className="size-4" />
            Quick Create
          </button>
          <button
            aria-label="Inbox"
            className="flex size-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07]"
          >
            <Icon name="mail" />
          </button>
        </div>

        {/* main nav */}
        <nav className="mt-3 space-y-0.5">
          {NAV.map((item) => (
            <button
              key={item.label}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors ${
                item.active
                  ? "bg-white/[0.07] font-medium text-white"
                  : "text-zinc-300 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* studios */}
        <p className="mt-6 px-2.5 text-[11px] text-zinc-500">Studios</p>
        <nav className="mt-1 space-y-0.5">
          {studios.slice(0, 4).map((s) => (
            <Link
              key={s.id}
              href={`/studio/${s.slug}`}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-zinc-300 transition-colors hover:bg-white/[0.04] hover:text-white"
            >
              <Icon name="video" />
              <span className="truncate">{s.name}</span>
            </Link>
          ))}
          <a
            href="#studios"
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
          >
            <Icon name="more" />
            More
          </a>
        </nav>

        {/* user */}
        <div className="mt-auto flex items-center gap-2 rounded-md px-2 py-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-xs font-semibold text-white">
            {(userName[0] ?? "?").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[12px] font-medium text-white">
              {userName}
            </p>
            <p className="truncate text-[11px] text-zinc-500">{userEmail}</p>
          </div>
          <button
            onClick={onLogout}
            aria-label="Log out"
            className="rounded p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-white"
          >
            <Icon name="logout" />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  badge,
  badgeIcon,
  headline,
  headlineIcon,
  sub,
}: {
  label: string;
  value: string;
  badge: string;
  badgeIcon: "up" | "down";
  headline: string;
  headlineIcon: "up" | "down";
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
      <div className="flex items-start justify-between">
        <p className="text-[13px] text-zinc-400">{label}</p>
        <span className="flex items-center gap-1 rounded-md border border-white/[0.1] px-2 py-0.5 text-[10px] font-medium text-zinc-200">
          <Icon name={badgeIcon} className="size-2.5" />
          {badge}
        </span>
      </div>
      <p className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-white">
        {value}
      </p>
      <p className="mt-5 flex items-center gap-1.5 text-[12px] font-medium text-zinc-100">
        {headline}
        <Icon name={headlineIcon} className="size-3" />
      </p>
      <p className="mt-1 text-[12px] text-zinc-500">{sub}</p>
    </div>
  );
}

// ─── Area chart (sessions per studio) ────────────────────────────────────────
function AreaChart({ points }: { points: { label: string; value: number }[] }) {
  const VW = 1000;
  const VH = 240;
  const TOP = 16;

  const data = points.length === 1 ? [points[0], points[0]] : points;
  const max = Math.max(1, ...data.map((p) => p.value));
  const xy = data.map((p, i) => ({
    x: data.length === 1 ? 0 : (i / (data.length - 1)) * VW,
    y: VH - (p.value / max) * (VH - TOP),
  }));

  // Horizontal-tangent bezier: gives the soft "peaks" from the reference.
  const line = xy
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = xy[i - 1];
      const mx = (prev.x + p.x) / 2;
      return `C ${mx} ${prev.y}, ${mx} ${p.y}, ${p.x} ${p.y}`;
    })
    .join(" ");
  const area = xy.length ? `${line} L ${VW} ${VH} L 0 ${VH} Z` : "";

  return (
    <div>
      <div className="relative h-[220px] w-full">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
        >
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1="0"
              x2={VW}
              y1={VH * f}
              y2={VH * f}
              stroke="rgba(255,255,255,0.05)"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {area && <path d={area} fill="rgba(37,99,235,0.12)" />}
          {line && (
            <path
              d={line}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {!points.length && (
          <div className="absolute inset-0 flex items-center justify-center text-[13px] text-zinc-500">
            Create a studio to see its sessions here.
          </div>
        )}
      </div>
      {points.length > 0 && (
        <div className="mt-2 flex justify-between gap-2 text-[11px] text-zinc-500">
          {points.map((p) => (
            <span key={p.label} className="max-w-[20%] truncate">
              {p.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Session history ─────────────────────────────────────────────────────────
function SessionHistory({ studioId }: { studioId: string }) {
  const { data, isPending } = trpc.session.history.useQuery({ studioId });

  if (isPending)
    return <p className="px-4 py-3 text-xs text-zinc-500">Loading history…</p>;
  if (!data?.length)
    return (
      <p className="px-4 py-3 text-xs text-zinc-500">No past sessions yet.</p>
    );

  return (
    <ul className="divide-y divide-white/[0.06]">
      {data.map((s) => {
        const started = new Date(s.startedAt);
        const ended = s.endedAt ? new Date(s.endedAt) : null;
        const durMs = ended ? ended.getTime() - started.getTime() : null;
        const dur = durMs
          ? durMs < 60_000
            ? `${Math.round(durMs / 1000)}s`
            : `${Math.round(durMs / 60_000)}m`
          : "ongoing";

        return (
          <li
            key={s.id}
            className="flex justify-between px-4 py-2 text-xs text-zinc-400"
          >
            <span>
              {started.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}{" "}
              {started.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span
              className={`font-medium ${ended ? "text-zinc-500" : "text-blue-400"}`}
            >
              {ended ? dur : "● live"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Studio row ──────────────────────────────────────────────────────────────
function StudioRow({
  studio,
  onDelete,
}: {
  studio: Studio;
  onDelete: (id: string) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const n = studio._count.sessions;

  return (
    <li className="overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02]">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-white">
            {studio.name}
          </p>
          <p className="text-xs text-zinc-500">
            /{studio.slug} · {n} session{n === 1 ? "" : "s"}
          </p>
        </div>

        <div className="ml-3 flex shrink-0 items-center gap-1.5">
          {n > 0 && (
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-white/[0.06] hover:text-white"
            >
              {showHistory ? "Hide history" : "History"}
            </button>
          )}
          <button
            onClick={() => {
              if (window.confirm(`Delete "${studio.name}"?`))
                onDelete(studio.id);
            }}
            className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            Delete
          </button>
          <Link
            href={`/studio/${studio.slug}`}
            className="rounded-md bg-zinc-100 px-3 py-1.5 text-[13px] font-medium text-zinc-900 hover:bg-white"
          >
            Open
          </Link>
        </div>
      </div>

      {showHistory && (
        <div className="border-t border-white/[0.06] bg-black/20">
          <SessionHistory studioId={studio.id} />
        </div>
      )}
    </li>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [name, setName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!isPending && !session) router.push("/auth");
  }, [isPending, session, router]);

  const studiosQuery = trpc.studio.list.useQuery(undefined, {
    enabled: !!session,
  });
  const create = trpc.studio.create.useMutation({
    onSuccess: () => {
      setName("");
      utils.studio.list.invalidate();
    },
  });
  const deleteStudio = trpc.studio.delete.useMutation({
    onSuccess: () => utils.studio.list.invalidate(),
  });

  const studios = useMemo<Studio[]>(
    () => studiosQuery.data ?? [],
    [studiosQuery.data],
  );
  const totalSessions = studios.reduce((sum, s) => sum + s._count.sessions, 0);
  const active = studios.filter((s) => s._count.sessions > 0).length;
  const avg = studios.length ? totalSessions / studios.length : 0;
  const points = studios.map((s) => ({
    label: s.name,
    value: s._count.sessions,
  }));

  if (!isPending && !session) return null;

  const quickCreate = () => {
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    inputRef.current?.focus();
  };

  return (
    <div className="flex min-h-screen flex-1 bg-[#09090b] font-sans text-zinc-100 antialiased">
      <Sidebar
        open={sidebarOpen}
        studios={studios}
        userName={session?.user?.name ?? "You"}
        userEmail={session?.user?.email ?? ""}
        onQuickCreate={quickCreate}
        onLogout={() => signOut().then(() => router.push("/"))}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/[0.07] px-4">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle sidebar"
            className="rounded p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
          >
            <Icon name="panel" />
          </button>
          <span className="h-4 w-px bg-white/10" />
          <h1 className="text-[14px] font-medium text-white">Dashboard</h1>
        </header>

        <main className="flex-1 space-y-4 overflow-y-auto p-4 lg:p-5">
          {/* stat cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Total Studios"
              value={String(studios.length)}
              badge="Studios"
              badgeIcon="up"
              headline={
                studios.length ? "Ready to go live" : "Create your first studio"
              }
              headlineIcon="up"
              sub="Studios you own"
            />
            <StatCard
              label="Total Sessions"
              value={String(totalSessions)}
              badge="Sessions"
              badgeIcon="up"
              headline={
                totalSessions ? "Sessions hosted so far" : "No sessions yet"
              }
              headlineIcon={totalSessions ? "up" : "down"}
              sub="Across all studios"
            />
            <StatCard
              label="Active Studios"
              value={String(active)}
              badge={`${avg.toFixed(1)} avg`}
              badgeIcon={active ? "up" : "down"}
              headline={
                active ? "Studios with sessions" : "Nothing recorded yet"
              }
              headlineIcon={active ? "up" : "down"}
              sub="Average sessions per studio shown above"
            />
          </div>

          {/* chart */}
          <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
            <h2 className="text-[14px] font-semibold text-white">
              Session activity
            </h2>
            <p className="mb-5 mt-0.5 text-[12px] text-zinc-500">
              Sessions hosted per studio
            </p>
            <AreaChart points={points} />
          </section>

          {/* studios */}
          <section
            id="studios"
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5"
          >
            <h2 className="text-[14px] font-semibold text-white">
              Your studios
            </h2>
            <p className="mb-4 mt-0.5 text-[12px] text-zinc-500">
              Create, open and manage your recording studios
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) create.mutate({ name: name.trim() });
              }}
              className="mb-4 flex gap-2"
            >
              <input
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="New studio name"
                className="h-9 flex-1 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 text-[13px] text-white placeholder:text-zinc-500 focus:border-blue-500/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={create.isPending || !name.trim()}
                className="h-9 rounded-lg bg-zinc-100 px-4 text-[13px] font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
              >
                {create.isPending ? "Creating…" : "Create"}
              </button>
            </form>

            {studiosQuery.data?.length === 0 && (
              <div className="rounded-lg border border-dashed border-white/[0.1] p-10 text-center text-[13px] text-zinc-500">
                No studios yet. Create one above.
              </div>
            )}

            <ul className="space-y-2">
              {studios.map((s) => (
                <StudioRow
                  key={s.id}
                  studio={s}
                  onDelete={(id) => deleteStudio.mutate({ id })}
                />
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
