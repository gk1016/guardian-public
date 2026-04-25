"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle, Lock, User } from "lucide-react";

type ProfileProps = {
  profile: {
    handle: string;
    email: string;
    displayName: string | null;
    role: string;
    status: string;
    totpEnabled: boolean;
    memberSince: string;
  };
};

export function ProfileSettingsForm({ profile }: ProfileProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleChangePassword() {
    setError("");
    setSuccess("");

    if (!currentPassword) {
      setError("Current password is required.");
      return;
    }
    if (!newPassword) {
      setError("New password is required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/user/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to change password.");
          return;
        }
        setSuccess("Password changed successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        router.refresh();
      } catch {
        setError("Failed to reach server.");
      }
    });
  }

  const inputClass =
    "mt-1 block w-full rounded-2xl border border-[var(--color-border-bright)] bg-slate-950/70 px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition placeholder:text-[var(--color-text-faint)] focus:border-cyan-300/40";

  return (
    <div className="space-y-6">
      {/* Profile Info (read-only) */}
      <div className="rounded-2xl border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5">
        <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
          <User size={12} />
          Profile
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Handle</p>
            <p className="mt-1 text-sm font-medium text-[var(--color-text-strong)]">{profile.handle}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Email</p>
            <p className="mt-1 text-sm text-[var(--color-text-strong)]">{profile.email}</p>
          </div>
          {profile.displayName ? (
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Display Name</p>
              <p className="mt-1 text-sm text-[var(--color-text-strong)]">{profile.displayName}</p>
            </div>
          ) : null}
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Role</p>
            <p className="mt-1 text-sm uppercase tracking-[0.12em] text-[var(--color-text-strong)]">{profile.role}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Status</p>
            <p className="mt-1 text-sm text-[var(--color-text-strong)]">{profile.status}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Member Since</p>
            <p className="mt-1 text-sm text-[var(--color-text-strong)]">{profile.memberSince}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">2FA (TOTP)</p>
            <p className="mt-1 text-sm text-[var(--color-text-strong)]">{profile.totpEnabled ? "Enabled" : "Not configured"}</p>
          </div>
        </div>
      </div>

      {/* Password Change */}
      <div className="rounded-2xl border border-[var(--color-border-bright)] bg-[var(--color-panel)] p-5">
        <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
          <Lock size={12} />
          Change Password
        </div>

        {error ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-200">
            <AlertTriangle size={14} className="flex-shrink-0" />
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
            <CheckCircle size={14} className="flex-shrink-0" />
            {success}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-1 max-w-md">
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              Current Password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
              placeholder="Enter current password"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              New Password
            </span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              placeholder="Min 10 chars, upper + lower + digit + special"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
              Confirm New Password
            </span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              placeholder="Re-enter new password"
            />
          </label>
        </div>

        <button
          type="button"
          disabled={isPending || !currentPassword || !newPassword || !confirmPassword}
          onClick={handleChangePassword}
          className="mt-4 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-70"
        >
          {isPending ? "Changing..." : "Change Password"}
        </button>
      </div>
    </div>
  );
}
