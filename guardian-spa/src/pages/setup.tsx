import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Building2,
  Tag,
  Mail,
  User,
  KeyRound,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  FileText,
} from "lucide-react";

type Step = "org" | "admin" | "done";

export function SetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("org");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Org fields
  const [orgName, setOrgName] = useState("");
  const [orgTag, setOrgTag] = useState("");
  const [orgDescription, setOrgDescription] = useState("");

  // Admin fields
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function goToAdmin() {
    setError("");
    if (!orgName.trim()) { setError("Organization name is required."); return; }
    if (!orgTag.trim() || orgTag.length < 2) { setError("Org tag must be at least 2 characters."); return; }
    if (!/^[A-Z0-9]+$/.test(orgTag)) { setError("Tag must be uppercase letters and numbers only."); return; }
    setStep("admin");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !handle.trim() || !displayName.trim() || !password) {
      setError("All fields are required.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName,
          orgTag,
          orgDescription: orgDescription || undefined,
          email,
          handle: handle.toUpperCase(),
          displayName,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Setup failed.");
        return;
      }
      setStep("done");
    } catch {
      setError("Failed to connect to server.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full bg-transparent text-sm text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-faint)]";
  const fieldWrap =
    "flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-6 text-[var(--color-text)]">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6 text-center">
          <span className="font-[family:var(--font-display)] text-xl uppercase tracking-[0.2em] text-[var(--color-accent)]">
            Guardian
          </span>
          <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            First-Run Setup
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-5 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.12em]">
          <span className={step === "org" ? "text-[var(--color-accent)]" : "text-[var(--color-text-faint)]"}>Organization</span>
          <ChevronRight size={12} className="text-[var(--color-text-faint)]" />
          <span className={step === "admin" ? "text-[var(--color-accent)]" : "text-[var(--color-text-faint)]"}>Admin Account</span>
          <ChevronRight size={12} className="text-[var(--color-text-faint)]" />
          <span className={step === "done" ? "text-emerald-400" : "text-[var(--color-text-faint)]"}>Complete</span>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
          {/* Error banner */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-200">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}

          {/* Step 1: Organization */}
          {step === "org" && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                  Organization Name
                </label>
                <div className={fieldWrap}>
                  <Building2 size={15} className="text-[var(--color-text-faint)]" />
                  <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} className={inputClass} placeholder="e.g. Shadow Company" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                  Org Tag
                  <span className="ml-1 normal-case tracking-normal text-[var(--color-text-faint)]">(2-10 chars, uppercase)</span>
                </label>
                <div className={fieldWrap}>
                  <Tag size={15} className="text-[var(--color-text-faint)]" />
                  <input type="text" value={orgTag} onChange={(e) => setOrgTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))} className={inputClass} placeholder="e.g. SHADOW" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                  Description
                  <span className="ml-1 normal-case tracking-normal text-[var(--color-text-faint)]">(optional)</span>
                </label>
                <div className={fieldWrap}>
                  <FileText size={15} className="text-[var(--color-text-faint)]" />
                  <input type="text" value={orgDescription} onChange={(e) => setOrgDescription(e.target.value)} className={inputClass} placeholder="What does your org do?" />
                </div>
              </div>
              <button type="button" onClick={goToAdmin} className="w-full rounded-[var(--radius-md)] border border-amber-300/30 bg-amber-300 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-bg)] transition hover:bg-amber-200">
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Admin Account */}
          {step === "admin" && (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                  Email
                </label>
                <div className={fieldWrap}>
                  <Mail size={15} className="text-[var(--color-text-faint)]" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="commander@yourdomain.com" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    Callsign / Handle
                  </label>
                  <div className={fieldWrap}>
                    <User size={15} className="text-[var(--color-text-faint)]" />
                    <input type="text" value={handle} onChange={(e) => setHandle(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))} className={inputClass} placeholder="CALLSIGN" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    Display Name
                  </label>
                  <div className={fieldWrap}>
                    <User size={15} className="text-[var(--color-text-faint)]" />
                    <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} placeholder="Your Name" />
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                  Password
                  <span className="ml-1 normal-case tracking-normal text-[var(--color-text-faint)]">(min 10 chars, mixed case, number, special)</span>
                </label>
                <div className={fieldWrap}>
                  <KeyRound size={15} className="text-[var(--color-text-faint)]" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="Strong password" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                  Confirm Password
                </label>
                <div className={fieldWrap}>
                  <KeyRound size={15} className="text-[var(--color-text-faint)]" />
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} placeholder="Confirm password" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setStep("org"); setError(""); }} className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2.5 text-xs uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] transition hover:text-[var(--color-text-secondary)]">
                  Back
                </button>
                <button type="submit" disabled={loading} className="flex-1 rounded-[var(--radius-md)] border border-amber-300/30 bg-amber-300 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-bg)] transition hover:bg-amber-200 disabled:opacity-60">
                  {loading ? "Creating..." : "Create Organization"}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Done */}
          {step === "done" && (
            <div className="space-y-4 text-center">
              <CheckCircle size={40} className="mx-auto text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-strong)]">
                  {orgName} is ready.
                </p>
                <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                  Sign in with the admin account you just created.
                </p>
              </div>
              <button type="button" onClick={() => navigate("/login")} className="w-full rounded-[var(--radius-md)] border border-amber-300/30 bg-amber-300 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-bg)] transition hover:bg-amber-200">
                Go to Sign In
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] text-[var(--color-text-faint)]">
          Guardian Flight Platform
        </p>
      </div>
    </main>
  );
}
