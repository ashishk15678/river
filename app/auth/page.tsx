"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, signUp } from "@/lib/auth-client";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result =
      mode === "signin"
        ? await signIn.email({ email, password })
        : await signUp.email({ email, password, name });
    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? "Something went wrong");
      return;
    }
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#09090b]">
      {/* minimal nav */}
      <header className="flex h-14 items-center px-6 border-b border-white/[0.06]">
        <Link
          href="/"
          className="flex items-center gap-2 text-[15px] font-semibold text-white"
        >
          <div className="flex size-7 items-center justify-center rounded-md bg-blue-600">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
              aria-hidden
            >
              <path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.75-.43L16 10.5" />
              <rect x="2" y="6" width="14" height="12" rx="2" />
            </svg>
          </div>
          OnAir
        </Link>
      </header>

      {/* form area */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-7 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1.5 text-sm text-zinc-400">
              {mode === "signin"
                ? "Sign in to your OnAir studio"
                : "Start broadcasting in minutes"}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Full name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                  className="h-10 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 text-sm text-white placeholder:text-zinc-600 focus:border-blue-500/60 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="h-10 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 text-sm text-white placeholder:text-zinc-600 focus:border-blue-500/60 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="h-10 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 text-sm text-white placeholder:text-zinc-600 focus:border-blue-500/60 focus:outline-none"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 h-10 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {busy
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-zinc-500">
            {mode === "signin" ? "New to OnAir?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
              className="font-medium text-blue-400 hover:text-blue-300"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
