type PackageParticipant = {
  handle: string;
  role: string;
  status: string;
};

type PackageRoleDefinition = {
  key: string;
  label: string;
  requiredCount: number;
  matchers: string[];
  allowMissionLead?: boolean;
};

type PackageProfile = {
  code: string;
  label: string;
  missionTypeMatchers: string[];
  roles: PackageRoleDefinition[];
};

export type PackageRoleCheck = {
  key: string;
  label: string;
  requiredCount: number;
  matchedCount: number;
  matchedHandles: string[];
  openCount: number;
  openHandles: string[];
  shortfall: number;
};

export type PackageDiscipline = {
  profileCode: string;
  profileLabel: string;
  coverageLabel: "structured" | "degraded" | "insufficient";
  shortfallCount: number;
  warnings: string[];
  roleChecks: PackageRoleCheck[];
};

const packageProfiles: PackageProfile[] = [
  {
    code: "escort_cap",
    label: "Escort / CAP package",
    missionTypeMatchers: ["escort", "counter-piracy", "patrol", "cap"],
    roles: [
      { key: "package_lead", label: "Package lead", requiredCount: 1, matchers: ["lead", "commander"], allowMissionLead: true },
      { key: "escort_wing", label: "Escort wing", requiredCount: 1, matchers: ["escort", "wing", "cap", "interceptor"] },
      { key: "reserve_element", label: "Reserve element", requiredCount: 1, matchers: ["reserve", "qrf", "strike", "interceptor"] },
    ],
  },
  {
    code: "qrf",
    label: "QRF package",
    missionTypeMatchers: ["qrf", "response", "interdict"],
    roles: [
      { key: "qrf_lead", label: "QRF lead", requiredCount: 1, matchers: ["lead", "commander"], allowMissionLead: true },
      { key: "response_wing", label: "Response wing", requiredCount: 1, matchers: ["wing", "cap", "reserve", "escort"] },
    ],
  },
  {
    code: "csar",
    label: "CSAR package",
    missionTypeMatchers: ["csar", "rescue", "medevac"],
    roles: [
      { key: "rescue_lead", label: "Rescue lead", requiredCount: 1, matchers: ["lead", "coordinator"], allowMissionLead: true },
      { key: "rescue_bird", label: "Rescue bird", requiredCount: 1, matchers: ["rescue", "medevac", "cutlass red", "medical"] },
      { key: "escort_element", label: "Escort element", requiredCount: 1, matchers: ["escort", "wing", "cap", "security"] },
    ],
  },
  {
    code: "recon",
    label: "Recon package",
    missionTypeMatchers: ["recon", "intel", "surveillance"],
    roles: [
      { key: "recon_lead", label: "Recon lead", requiredCount: 1, matchers: ["lead", "recon", "observer"], allowMissionLead: true },
      { key: "overwatch", label: "Overwatch", requiredCount: 1, matchers: ["overwatch", "wing", "escort", "cover"] },
    ],
  },
];

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function selectProfile(missionType: string) {
  const normalizedMissionType = normalize(missionType);

  return (
    packageProfiles.find((profile) =>
      profile.missionTypeMatchers.some((matcher) => normalizedMissionType.includes(matcher)),
    ) ?? packageProfiles[0]
  );
}

function buildReadinessWarnings(
  readinessLabel: string,
  readyOrLaunched: number,
  total: number,
  openCount: number,
  staffedTotal: number,
) {
  if (total === 0) {
    return ["No package assigned to this mission."];
  }

  if (staffedTotal === 0 && openCount > 0) {
    return ["Template package seeded, but no slot is filled yet."];
  }

  if (readinessLabel === "cold") {
    return ["Package has staffed elements, but none are ready or launched."];
  }

  if (readinessLabel === "partial") {
    return [`Only ${readyOrLaunched}/${staffedTotal} staffed elements are ready or launched.`];
  }

  return [];
}

export function evaluatePackageDiscipline(
  missionType: string,
  participants: PackageParticipant[],
  missionLeadDisplay: string,
  readinessLabel: string,
  readyOrLaunched: number,
  total: number,
  openCount: number,
  staffedTotal: number,
) {
  const profile = selectProfile(missionType);
  const staffedParticipantIndexes = new Set(
    participants
      .map((participant, index) => (normalize(participant.status) === "open" ? null : index))
      .filter((value): value is number => value !== null),
  );
  const openParticipantIndexes = new Set(
    participants
      .map((participant, index) => (normalize(participant.status) === "open" ? index : null))
      .filter((value): value is number => value !== null),
  );
  const missionLeadAssigned = normalize(missionLeadDisplay) !== "unassigned";

  const roleChecks = profile.roles.map((role) => {
    const matchedHandles: string[] = [];
    const openHandles: string[] = [];
    let matchedCount = 0;

    if (role.allowMissionLead && missionLeadAssigned && matchedCount < role.requiredCount) {
      matchedHandles.push(missionLeadDisplay);
      matchedCount += 1;
    }

    for (const index of Array.from(staffedParticipantIndexes)) {
      if (matchedCount >= role.requiredCount) {
        break;
      }

      const participant = participants[index];
      const searchTarget = `${normalize(participant.role)} ${normalize(participant.status)}`;
      const matches = role.matchers.some((matcher) => searchTarget.includes(matcher));

      if (!matches) {
        continue;
      }

      matchedHandles.push(participant.handle);
      matchedCount += 1;
      staffedParticipantIndexes.delete(index);
    }

    for (const index of Array.from(openParticipantIndexes)) {
      if (matchedCount + openHandles.length >= role.requiredCount) {
        break;
      }

      const participant = participants[index];
      const searchTarget = `${normalize(participant.role)} ${normalize(participant.status)}`;
      const matches = role.matchers.some((matcher) => searchTarget.includes(matcher));

      if (!matches) {
        continue;
      }

      openHandles.push(participant.handle);
      openParticipantIndexes.delete(index);
    }

    const openRoleCount = Math.min(openHandles.length, Math.max(0, role.requiredCount - matchedCount));
    const shortfall = Math.max(0, role.requiredCount - matchedCount - openRoleCount);

    return {
      key: role.key,
      label: role.label,
      requiredCount: role.requiredCount,
      matchedCount,
      matchedHandles,
      openCount: openRoleCount,
      openHandles: openHandles.slice(0, openRoleCount),
      shortfall,
    } satisfies PackageRoleCheck;
  });

  const structuralWarnings = roleChecks.flatMap((roleCheck) => {
    const warnings: string[] = [];

    if (roleCheck.openCount > 0) {
      warnings.push(
        `Open ${roleCheck.openCount} ${roleCheck.label.toLowerCase()} slot${roleCheck.openCount > 1 ? "s" : ""}.`,
      );
    }

    if (roleCheck.shortfall > 0) {
      warnings.push(
        `Missing ${roleCheck.shortfall} ${roleCheck.label.toLowerCase()} slot${roleCheck.shortfall > 1 ? "s" : ""}.`,
      );
    }

    return warnings;
  });

  const warnings = [
    ...structuralWarnings,
    ...buildReadinessWarnings(readinessLabel, readyOrLaunched, total, openCount, staffedTotal),
  ];
  const issueCount = structuralWarnings.length;

  return {
    profileCode: profile.code,
    profileLabel: profile.label,
    coverageLabel: issueCount === 0 ? "structured" : issueCount === 1 ? "degraded" : "insufficient",
    shortfallCount: issueCount,
    warnings,
    roleChecks,
  } satisfies PackageDiscipline;
}
