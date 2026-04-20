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

function buildReadinessWarnings(readinessLabel: string, readyOrLaunched: number, total: number) {
  if (total === 0) {
    return ["No package assigned to this mission."];
  }

  if (readinessLabel === "cold") {
    return ["Package is staffed but no assigned element is ready or launched."];
  }

  if (readinessLabel === "partial") {
    return [`Only ${readyOrLaunched}/${total} assigned elements are ready or launched.`];
  }

  return [];
}

export function evaluatePackageDiscipline(
  missionType: string,
  participants: PackageParticipant[],
  missionLeadDisplay: string,
  readinessLabel: string,
  readyOrLaunched: number,
) {
  const profile = selectProfile(missionType);
  const unassignedParticipantIndexes = new Set(participants.map((_, index) => index));
  const missionLeadAssigned = normalize(missionLeadDisplay) !== "unassigned";

  const roleChecks = profile.roles.map((role) => {
    const matchedHandles: string[] = [];
    let matchedCount = 0;

    if (role.allowMissionLead && missionLeadAssigned && matchedCount < role.requiredCount) {
      matchedHandles.push(missionLeadDisplay);
      matchedCount += 1;
    }

    for (const index of Array.from(unassignedParticipantIndexes)) {
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
      unassignedParticipantIndexes.delete(index);
    }

    return {
      key: role.key,
      label: role.label,
      requiredCount: role.requiredCount,
      matchedCount,
      matchedHandles,
      shortfall: Math.max(0, role.requiredCount - matchedCount),
    } satisfies PackageRoleCheck;
  });

  const structuralWarnings = roleChecks
    .filter((roleCheck) => roleCheck.shortfall > 0)
    .map((roleCheck) => `Missing ${roleCheck.shortfall} ${roleCheck.label.toLowerCase()} slot${roleCheck.shortfall > 1 ? "s" : ""}.`);

  const warnings = [...structuralWarnings, ...buildReadinessWarnings(readinessLabel, readyOrLaunched, participants.length)];
  const shortfallCount = structuralWarnings.length;

  return {
    profileCode: profile.code,
    profileLabel: profile.label,
    coverageLabel: shortfallCount === 0 ? "structured" : shortfallCount === 1 ? "degraded" : "insufficient",
    shortfallCount,
    warnings,
    roleChecks,
  } satisfies PackageDiscipline;
}
