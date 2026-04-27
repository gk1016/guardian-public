import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { KeyRound, User, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get("next") || "/command";
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Sign in failed.");
        return;
      }
      await refresh();
      navigate(nextPath, { replace: true });
    } catch {
      setError("Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-6 text-[var(--color-text)]">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="font-[family:var(--font-display)] text-xl uppercase tracking-[0.2em] text-[var(--color-accent)]">
            Guardian
          </span>
          <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Sign in to operations
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                Email
              </label>
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
                <User size={15} className="text-[var(--color-text-faint)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-sm text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-faint)]"
                  placeholder="you@yourdomain.com"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                Password
              </label>
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
                <KeyRound size={15} className="text-[var(--color-text-faint)]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-sm text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-faint)]"
                  placeholder="Password"
                />
              </div>
            </div>
            {error ? (
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-200">
                <AlertTriangle size={14} />
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[var(--radius-md)] border border-amber-300/30 bg-amber-300 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-amber-200 disabled:opacity-60"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-[11px] text-[var(--color-text-faint)]">
          <Link to="/" className="transition hover:text-[var(--color-text-strong)]">
            Back to public site
          </Link>
        </p>
      </div>
    </main>
  );
}
