"use client";

import { useState, useEffect, type FormEvent } from "react";
import { PublicNav } from "@/components/public-nav";
import { Siren, Users, Send, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

type RecruitConfig = {
  enabled: boolean;
  orgName: string;
  headline: string;
  description: string;
  values: string[];
  ctaText: string;
};

export default function RecruitPage() {
  const [config, setConfig] = useState<RecruitConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    fetch("/api/recruit/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setConfig({
            enabled: data.enabled,
            orgName: data.orgName || "Organization",
            headline: data.headline || "Join the crew.",
            description: data.description || "",
            values: Array.isArray(data.values) ? data.values : [],
            ctaText: data.ctaText || "Submit Application",
          });
        }
      })
      .catch(() => setError("Failed to load recruitment info."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/recruit/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: handle.trim(),
          name: name.trim(),
          email: email.trim() || undefined,
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSubmitted(true);
      } else {
        setSubmitError(data.error || "Failed to submit application.");
      }
    } catch {
      setSubmitError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.15),_transparent_35%),linear-gradient(180deg,_#0a0e14_0%,_#070b12_100%)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-6 pb-20 pt-6 lg:px-10">
        <PublicNav variant="subpage" />

        <section className="pt-14">
          <div className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-amber-300/20 bg-amber-300/8 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-amber-200">
            <Siren size={12} />
            Recruitment
          </div>

          {loading ? (
            <div className="mt-8 flex items-center gap-3 text-[var(--color-text-tertiary)]">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : error ? (
            <p className="mt-8 text-sm text-red-400">{error}</p>
          ) : config && !config.enabled ? (
            <>
              <h1 className="mt-5 max-w-3xl font-[family:var(--font-display)] text-3xl uppercase leading-[0.95] tracking-[0.06em] text-[var(--color-text-strong)] sm:text-4xl lg:text-5xl">
                Recruitment
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-text-secondary)]">
                This org uses Guardian to run operations. If you're interested in joining, check back later.
              </p>
              <div className="mt-14 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
                <div className="flex items-center gap-3">
                  <Users size={18} className="text-[var(--color-text-tertiary)]" />
                  <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.08em] text-[var(--color-text-strong)]">
                    Applications
                  </h2>
                </div>
                <p className="mt-3 max-w-xl text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                  The recruitment page for this org has not been configured yet. Check back later, or contact the org directly if you have another way to reach them.
                </p>
              </div>
            </>
          ) : config ? (
            <>
              <h1 className="mt-5 max-w-3xl font-[family:var(--font-display)] text-3xl uppercase leading-[0.95] tracking-[0.06em] text-[var(--color-text-strong)] sm:text-4xl lg:text-5xl">
                {config.headline}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-text-secondary)]">
                {config.description}
              </p>

              {config.values.length > 0 && (
                <div className="mt-10">
                  <h2 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
                    <Users size={12} />
                    What we value
                  </h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {config.values.map((v, i) => (
                      <span
                        key={i}
                        className="rounded-[var(--radius-md)] border border-amber-300/20 bg-amber-300/8 px-3 py-1.5 text-xs text-amber-200"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-14">
                {submitted ? (
                  <div className="rounded-[var(--radius-lg)] border border-emerald-500/20 bg-emerald-500/8 p-6">
                    <div className="flex items-center gap-3">
                      <CheckCircle size={20} className="text-emerald-400" />
                      <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.08em] text-emerald-300">
                        Application Submitted
                      </h2>
                    </div>
                    <p className="mt-3 max-w-xl text-[13px] leading-[1.6] text-emerald-200/80">
                      Your application has been received. The org leadership will review it and reach out if you're a fit. Good luck.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
                    <div className="flex items-center gap-3">
                      <Send size={16} className="text-[var(--color-text-tertiary)]" />
                      <h2 className="font-[family:var(--font-display)] text-sm uppercase tracking-[0.08em] text-[var(--color-text-strong)]">
                        Apply
                      </h2>
                    </div>
                    <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                            Handle *
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={64}
                            value={handle}
                            onChange={(e) => setHandle(e.target.value)}
                            placeholder="Your in-game or org handle"
                            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-amber-400/40 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                            Name *
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={128}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="What should we call you"
                            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-amber-400/40 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                          Email (optional)
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="For follow-up contact"
                          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-amber-400/40 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                          Message (optional)
                        </label>
                        <textarea
                          maxLength={2000}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={4}
                          placeholder="Tell us about yourself, your experience, and why you want to join."
                          className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-amber-400/40 focus:outline-none"
                        />
                      </div>
                      {submitError && (
                        <div className="flex items-center gap-2 text-sm text-red-400">
                          <AlertCircle size={14} />
                          {submitError}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-amber-300/30 bg-amber-300 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-950 transition hover:bg-amber-200 disabled:opacity-50"
                      >
                        {submitting ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Send size={14} />
                        )}
                        {config.ctaText}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
