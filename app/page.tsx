import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-brand-subtle px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-lg text-brand">OnAir</span>
        <nav className="flex gap-3">
          <Link
            href="/auth"
            className="px-4 py-2 text-sm rounded-md hover:bg-brand-subtle"
          >
            Log in
          </Link>
          <Link
            href="/auth"
            className="px-4 py-2 text-sm rounded-md bg-brand text-white hover:bg-brand-light"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="pattern-dots flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <h1 className="text-4xl sm:text-5xl font-bold max-w-2xl">
          A live studio, right in the browser
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-xl">
          Bring guests into a multi-camera studio, chat live, switch layouts on
          the fly, and record — no downloads required.
        </p>
        <Link
          href="/login"
          className="mt-8 px-6 py-3 rounded-md bg-brand text-white font-medium hover:bg-brand-light"
        >
          Create your studio
        </Link>
      </section>

      <footer className="border-t border-brand-subtle px-6 py-4 text-sm text-slate-500 text-center">
        OnAir — built with Next.js, tRPC, Socket.io and WebRTC.
      </footer>
    </main>
  );
}
