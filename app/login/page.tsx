"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, User, AlertTriangle } from "lucide-react";

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
      if (!response.ok) { setError(payload.error || "Sign in failed."); return; }
      router.push(nextPath);
      router.refresh();
    } catch { setError("Sign in failed."); } finally { setLoading(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-6 text-[var(--color-text)]">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="font-[family:var(--font-display)] text-xl uppercase tracking-[0.2em] text-[var(--color-accent)]">Guardian</span>
          <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Sign in to operations</p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Email</label>
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
                <User size={15} className="text-[var(--color-text-faint)]" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent text-sm text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-faint)]" placeholder="pilot@guardian.local" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Password</label>
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
                <KeyRound size={15} className="text-[var(--color-text-faint)]" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent text-sm text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-faint)]" placeholder="Password" />
              </div>
            </div>
            {error ? (
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-200">
                <AlertTriangle size={14} />{error}
              </div>
            ) : null}
            <button type="submit" disabled={loading} className="w-full rounded-[var(--radius-md)] border border-amber-300/30 bg-amber-300 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-amber-200 disabled:opacity-60">
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>
          <p className="mt-4 text-center text-[11px] text-[var(--color-text-tertiary)]">
            Demo: reaper11@guardian.local / GuardianDemo!2026
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] text-[var(--color-text-faint)]">
          <Link href="/" className="transition hover:text-[var(--color-text-strong)]">Back to public site</Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginScreen /></Suspense>;
}
