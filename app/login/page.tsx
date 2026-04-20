"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, User, KeyRound, AlertTriangle } from "lucide-react";

function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/command";
  const [email, setEmail] = useState("reaper11@guardian.local");
  const [password, setPassword] = useState("GuardianDemo!2026");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Failed to sign in.");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Failed to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] px-6 py-10 text-[var(--color-text)] lg:px-10">
      <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <section className="rounded-3xl border border-white/10 bg-slate-950/55 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <div className="inline-flex items-center gap-3 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-amber-200">
            <Shield size={14} />
            Authenticated Operations Access
          </div>
          <h1 className="mt-6 font-[family:var(--font-display)] text-5xl uppercase tracking-[0.14em] text-white">
            Sign in to Guardian
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
            Ops pages are now protected. This login is intentionally boring: credentials, signed cookie,
            middleware gate, and no cloud auth dependency.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Demo Account</p>
              <p className="mt-3 text-white">`reaper11@guardian.local`</p>
              <p className="mt-2 text-sm text-slate-300">Role: commander</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Demo Password</p>
              <p className="mt-3 text-white">`GuardianDemo!2026`</p>
              <p className="mt-2 text-sm text-slate-300">Seeded through Prisma for bootstrap access.</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <form className="space-y-5" onSubmit={onSubmit}>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">
                Email
              </label>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <User size={18} className="text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                  placeholder="pilot@guardian.local"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">
                Password
              </label>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <KeyRound size={18} className="text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                  placeholder="Password"
                />
              </div>
            </div>

            {error ? (
              <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl border border-amber-300/35 bg-amber-300 px-5 py-3 font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Signing In..." : "Enter Command Deck"}
            </button>
          </form>

          <div className="mt-6 text-sm text-slate-400">
            Public site remains available at{" "}
            <Link href="/" className="text-white transition hover:text-amber-200">
              /
            </Link>
            .
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
