"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";

export default function LoginPage() {
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
    <main className="pattern-dots flex-1 flex items-center justify-center px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white border border-brand-subtle rounded-lg p-6 shadow-sm space-y-4"
      >
        <h1 className="text-xl font-semibold text-center">
          {mode === "signin" ? "Log in to OnAir" : "Create your OnAir account"}
        </h1>

        {mode === "signup" && (
          <input
            className="w-full border border-brand-subtle rounded-md px-3 py-2 text-sm"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}
        <input
          className="w-full border border-brand-subtle rounded-md px-3 py-2 text-sm"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full border border-brand-subtle rounded-md px-3 py-2 text-sm"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-brand text-white rounded-md py-2 text-sm font-medium hover:bg-brand-light disabled:opacity-60"
        >
          {busy ? "Please wait…" : mode === "signin" ? "Log in" : "Sign up"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full text-sm text-brand hover:underline"
        >
          {mode === "signin"
            ? "Need an account? Sign up"
            : "Have an account? Log in"}
        </button>
      </form>
    </main>
  );
}
