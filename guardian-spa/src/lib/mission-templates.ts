export type MissionTemplateSlot = {
  role: string;
  platform: string;
  notes: string;
};

export type MissionTemplate = {
  code: string;
  label: string;
  summary: string;
  recommendedPackage: string;
  doctrineCode: string;
  recommendedDoctrine: string;
  suggestedCallsign: string;
  suggestedTitle: string;
  suggestedPriority: "routine" | "priority" | "critical";
  suggestedAreaOfOperation: string;
  suggestedBrief: string;
  slots: MissionTemplateSlot[];
};

export const missionTemplates: MissionTemplate[] = [
  {
    code: "counter-piracy",
    label: "Counter-Piracy Escort",
    summary: "Interdict pirate strike groups, protect civilian traffic, and hold air cover over common convoy lanes.",
    recommendedPackage: "Escort / CAP package",
    doctrineCode: "weapons_tight",
    recommendedDoctrine: "Weapons Tight",
    suggestedCallsign: "VIGIL 21",
    suggestedTitle: "Interdict pirate strike package",
    suggestedPriority: "priority",
    suggestedAreaOfOperation: "Yela common lanes",
    suggestedBrief:
      "Launch two-ship CAP with escort reserve. Interdict hostile pack, protect civilians, and hold contact reports for follow-on QRF.",
    slots: [
      {
        role: "escort wing",
        platform: "F7A Mk II",
        notes: "Primary escort element responsible for fixing hostile intercept geometry.",
      },
      {
        role: "reserve element",
        platform: "F8C Lightning",
        notes: "Hold reserve posture and reinforce the merge only on command.",
      },
    ],
  },
  {
    code: "qrf",
    label: "Quick Reaction Force",
    summary: "Launch an immediate response package to reinforce a threatened area, stabilize the fight, and regain control.",
    recommendedPackage: "QRF package",
    doctrineCode: "weapons_free",
    recommendedDoctrine: "Weapons Free",
    suggestedCallsign: "LANCER 31",
    suggestedTitle: "Rapid response launch to reinforce contact",
    suggestedPriority: "critical",
    suggestedAreaOfOperation: "ARC-L1 response lane",
    suggestedBrief:
      "Stand up immediate response package, reinforce the threatened sector, and contain hostile maneuver until the mission commander regains initiative.",
    slots: [
      {
        role: "response wing",
        platform: "F8C Lightning",
        notes: "Immediate response wing prepared to reinforce the threatened sector without delay.",
      },
    ],
  },
  {
    code: "csar",
    label: "Combat Search And Rescue",
    summary: "Recover stranded operators, protect the rescue bird, and escort the package home without creating a second emergency.",
    recommendedPackage: "CSAR package",
    doctrineCode: "weapons_free",
    recommendedDoctrine: "Weapons Free",
    suggestedCallsign: "ORBITER 41",
    suggestedTitle: "Recover downed pilot and escort rescue bird",
    suggestedPriority: "critical",
    suggestedAreaOfOperation: "Daymar rescue corridor",
    suggestedBrief:
      "Launch rescue bird with escort element, establish survivor comms, recover isolated personnel, and maintain cover through extraction and RTB.",
    slots: [
      {
        role: "rescue bird",
        platform: "Cutlass Red",
        notes: "Primary medevac and survivor recovery ship.",
      },
      {
        role: "escort element",
        platform: "F7A Mk II",
        notes: "Protect the rescue corridor and prevent hostile re-attack geometry.",
      },
    ],
  },
  {
    code: "recon",
    label: "Recon / Surveillance",
    summary: "Build the threat picture, confirm hostile posture, and preserve standoff while feeding the board with useful reporting.",
    recommendedPackage: "Recon package",
    doctrineCode: "weapons_hold",
    recommendedDoctrine: "Weapons Hold",
    suggestedCallsign: "SPECTER 12",
    suggestedTitle: "Recon hostile route and confirm threat picture",
    suggestedPriority: "routine",
    suggestedAreaOfOperation: "MicroTech approach lanes",
    suggestedBrief:
      "Push recon element with overwatch, confirm route activity, identify hostile patterns, and maintain standoff reporting for follow-on tasking.",
    slots: [
      {
        role: "overwatch",
        platform: "Hornet Tracker",
        notes: "Maintain standoff cover and preserve the reporting lane for the recon lead.",
      },
    ],
  },
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function getMissionTemplate(code: string) {
  const normalizedCode = normalize(code);

  return (
    missionTemplates.find((template) => normalize(template.code) === normalizedCode) ??
    missionTemplates.find((template) => normalizedCode.includes(normalize(template.code))) ??
    missionTemplates[0]
  );
}
