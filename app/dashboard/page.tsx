"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/client/trpc";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [name, setName] = useState("");
  const utils = trpc.useUtils();

  const studios = trpc.studio.list.useQuery(undefined, { enabled: !!session });
  const create = trpc.studio.create.useMutation({
    onSuccess: () => {
      setName("");
      utils.studio.list.invalidate();
    },
  });

  if (!isPending && !session) {
    router.push("/login");
    return null;
  }

  return (
    <main className="flex-1 px-6 py-10 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Your studios</h1>
        <button
          onClick={() => signOut().then(() => router.push("/"))}
          className="text-sm text-slate-500 hover:text-brand"
        >
          Log out
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate({ name: name.trim() });
        }}
        className="flex gap-2 mb-8"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New studio name"
          className="flex-1 border border-brand-subtle rounded-md px-3 py-2 text-sm"
        />
        <Button
          disabled={create.isPending}
          className="px-8 py-2 text-xl font-bolder rounded-md  text-sm font-medium hover:bg-brand-light disabled:opacity-60"
        >
          Create
        </Button>
      </form>

      {studios.data?.length === 0 && (
        <div className="pattern-dots rounded-lg border border-brand-subtle p-10 text-center text-slate-500">
          No studios yet — create one above.
        </div>
      )}

      <ul className="space-y-2">
        {studios.data?.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between border border-brand-subtle rounded-md px-4 py-3"
          >
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-xs text-slate-500">
                /{s.slug} · {s._count.sessions} session
                {s._count.sessions === 1 ? "" : "s"}
              </p>
            </div>
            <Link
              href={`/studio/${s.slug}`}
              className="px-3 py-1.5 text-sm rounded-md bg-brand-subtle text-brand hover:bg-blue-100"
            >
              Open
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
