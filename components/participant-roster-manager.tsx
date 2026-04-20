"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LoaderCircle, Save, Trash2 } from "lucide-react";

const participantStatusOptions = [
  { value: "open", label: "Open Slot" },
  { value: "assigned", label: "Assigned" },
  { value: "ready", label: "Ready" },
  { value: "launched", label: "Launched" },
  { value: "rtb", label: "RTB" },
] as const;

type Participant = {
  id: string;
  handle: string;
  role: string;
  platform: string | null;
  status: string;
  notes: string | null;
};

type CrewCandidate = {
  handle: string;
  displayName: string | null;
  orgRole: string;
  membershipTitle: string | null;
  qrfStatus: string | null;
  suggestedPlatform: string | null;
  sourceLabel: string;
  notes: string | null;
};

type ParticipantRosterManagerProps = {
  missionId: string;
  participants: Participant[];
  availableCrew: CrewCandidate[];
};

export function ParticipantRosterManager({
  missionId,
  participants,
  availableCrew,
}: ParticipantRosterManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [participantDrafts, setParticipantDrafts] = useState<
    Record<string, { handle: string; status: string; role: string; platform: string; notes: string }>
  >(
    Object.fromEntries(
      participants.map((participant) => [
        participant.id,
        {
          handle: participant.handle,
          status: participant.status,
          role: participant.role,
          platform: participant.platform ?? "",
          notes: participant.notes ?? "",
        },
      ]),
    ),
  );

  function setParticipantDraft(
    participantId: string,
    field: "handle" | "status" | "role" | "platform" | "notes",
    value: string,
  ) {
    setParticipantDrafts((current) => ({
      ...current,
      [participantId]: {
        ...current[participantId],
        [field]: value,
      },
    }));
  }

  function handleStatusSave(participantId: string) {
    const draft = participantDrafts[participantId];
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/missions/${missionId}/participants/${participantId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              handle: draft.handle,
              status: draft.status,
              role: draft.role,
              platform: draft.platform,
              notes: draft.notes,
            }),
          },
        );

        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || "Participant update failed.");
          return;
        }

        router.refresh();
      } catch {
        setError("Participant update failed.");
      }
    });
  }

  function handleRemove(participantId: string) {
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/missions/${missionId}/participants/${participantId}`,
          {
            method: "DELETE",
          },
        );

        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || "Participant removal failed.");
          return;
        }

        router.refresh();
      } catch {
        setError("Participant removal failed.");
      }
    });
  }

  function scoreCrewCandidate(role: string, candidate: CrewCandidate) {
    const roleText = role.toLowerCase();
    const profile = `${candidate.orgRole} ${candidate.membershipTitle ?? ""} ${candidate.suggestedPlatform ?? ""} ${candidate.qrfStatus ?? ""}`.toLowerCase();
    let score = candidate.qrfStatus ? 4 : 0;

    if (roleText.includes("rescue") || roleText.includes("medical")) {
      if (profile.includes("rescue") || profile.includes("medical") || profile.includes("cutlass red")) {
        score += 6;
      }
    }

    if (roleText.includes("escort") || roleText.includes("wing") || roleText.includes("cap")) {
      if (profile.includes("pilot") || profile.includes("f7") || profile.includes("f8") || profile.includes("escort")) {
        score += 5;
      }
    }

    if (roleText.includes("recon") || roleText.includes("overwatch")) {
      if (profile.includes("recon") || profile.includes("tracker") || profile.includes("overwatch")) {
        score += 6;
      }
    }

    if (roleText.includes("reserve") || roleText.includes("response")) {
      if (profile.includes("redcon") || profile.includes("reserve") || profile.includes("pilot")) {
        score += 5;
      }
    }

    return score;
  }

  function getRecommendedCrew(role: string) {
    return [...availableCrew]
      .sort((left, right) => scoreCrewCandidate(role, right) - scoreCrewCandidate(role, left))
      .slice(0, 3);
  }

  function applyCrewSuggestion(participantId: string, candidate: CrewCandidate) {
    setParticipantDrafts((current) => ({
      ...current,
      [participantId]: {
        ...current[participantId],
        handle: candidate.handle,
        platform: candidate.suggestedPlatform ?? current[participantId]?.platform ?? "",
        status: current[participantId]?.status === "open" ? "assigned" : current[participantId]?.status ?? "assigned",
        notes: candidate.notes ?? current[participantId]?.notes ?? "",
      },
    }));
  }

  return (
    <div className="space-y-4">
      {participants.map((participant) => (
        (() => {
          const recommendedCrew = getRecommendedCrew(participantDrafts[participant.id]?.role ?? participant.role);
          return (
        <div
          key={participant.id}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-[family:var(--font-display)] text-xl uppercase tracking-[0.14em] text-white">
                {participant.handle}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">Package control row</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={participantDrafts[participant.id]?.status ?? participant.status}
                onChange={(event) => setParticipantDraft(participant.id, "status", event.target.value)}
                className="rounded-md border border-white/10 bg-slate-950/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100 outline-none transition focus:border-cyan-300/40"
              >
                {participantStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={isPending}
                onClick={() => handleStatusSave(participant.id)}
                className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <LoaderCircle size={14} className="animate-spin" />
                    Saving
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Save size={14} />
                    Save
                  </span>
                )}
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => handleRemove(participant.id)}
                className="inline-flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Remove
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Handle</span>
              <input
                value={participantDrafts[participant.id]?.handle ?? participant.handle}
                onChange={(event) => setParticipantDraft(participant.id, "handle", event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Role</span>
              <input
                value={participantDrafts[participant.id]?.role ?? participant.role}
                onChange={(event) => setParticipantDraft(participant.id, "role", event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Platform</span>
              <input
                value={participantDrafts[participant.id]?.platform ?? (participant.platform ?? "")}
                onChange={(event) => setParticipantDraft(participant.id, "platform", event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              />
            </label>
          </div>

          <label className="mt-4 block space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Notes</span>
            <textarea
              value={participantDrafts[participant.id]?.notes ?? (participant.notes ?? "")}
              onChange={(event) => setParticipantDraft(participant.id, "notes", event.target.value)}
              rows={3}
              className="w-full rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4 text-sm text-white outline-none transition focus:border-cyan-300/40"
            />
          </label>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Quick Fill Recommendations</p>
            <div className="mt-3 grid gap-3">
              {recommendedCrew.map((candidate) => (
                <button
                  key={`${participant.id}-${candidate.handle}`}
                  type="button"
                  onClick={() => applyCrewSuggestion(participant.id, candidate)}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
                >
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
                      {candidate.displayName ?? candidate.handle}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                      {candidate.handle} / {candidate.suggestedPlatform ?? "Platform pending"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.16em] text-cyan-100">
                      {candidate.qrfStatus ?? candidate.sourceLabel}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                      {candidate.orgRole}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
          );
        })()
      ))}

      {participants.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
          No package assigned yet.
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
