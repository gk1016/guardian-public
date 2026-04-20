export type MissionTemplate = {
  code: string;
  label: string;
  summary: string;
  recommendedPackage: string;
  recommendedDoctrine: string;
  suggestedCallsign: string;
  suggestedTitle: string;
  suggestedPriority: "routine" | "priority" | "critical";
  suggestedAreaOfOperation: string;
  suggestedBrief: string;
};

export const missionTemplates: MissionTemplate[] = [
  {
    code: "counter-piracy",
    label: "Counter-Piracy Escort",
    summary: "Interdict pirate strike groups, protect civilian traffic, and hold air cover over common convoy lanes.",
    recommendedPackage: "Escort / CAP package",
    recommendedDoctrine: "Weapons Tight",
    suggestedCallsign: "VIGIL 21",
    suggestedTitle: "Interdict pirate strike package",
    suggestedPriority: "priority",
    suggestedAreaOfOperation: "Yela common lanes",
    suggestedBrief:
      "Launch two-ship CAP with escort reserve. Interdict hostile pack, protect civilians, and hold contact reports for follow-on QRF.",
  },
  {
    code: "qrf",
    label: "Quick Reaction Force",
    summary: "Launch an immediate response package to reinforce a threatened area, stabilize the fight, and regain control.",
    recommendedPackage: "QRF package",
    recommendedDoctrine: "Weapons Free",
    suggestedCallsign: "LANCER 31",
    suggestedTitle: "Rapid response launch to reinforce contact",
    suggestedPriority: "critical",
    suggestedAreaOfOperation: "ARC-L1 response lane",
    suggestedBrief:
      "Stand up immediate response package, reinforce the threatened sector, and contain hostile maneuver until the mission commander regains initiative.",
  },
  {
    code: "csar",
    label: "Combat Search And Rescue",
    summary: "Recover stranded operators, protect the rescue bird, and escort the package home without creating a second emergency.",
    recommendedPackage: "CSAR package",
    recommendedDoctrine: "Weapons Tight",
    suggestedCallsign: "ORBITER 41",
    suggestedTitle: "Recover downed pilot and escort rescue bird",
    suggestedPriority: "critical",
    suggestedAreaOfOperation: "Daymar rescue corridor",
    suggestedBrief:
      "Launch rescue bird with escort element, establish survivor comms, recover isolated personnel, and maintain cover through extraction and RTB.",
  },
  {
    code: "recon",
    label: "Recon / Surveillance",
    summary: "Build the threat picture, confirm hostile posture, and preserve standoff while feeding the board with useful reporting.",
    recommendedPackage: "Recon package",
    recommendedDoctrine: "Weapons Hold",
    suggestedCallsign: "SPECTER 12",
    suggestedTitle: "Recon hostile route and confirm threat picture",
    suggestedPriority: "routine",
    suggestedAreaOfOperation: "MicroTech approach lanes",
    suggestedBrief:
      "Push recon element with overwatch, confirm route activity, identify hostile patterns, and maintain standoff reporting for follow-on tasking.",
  },
];

export function getMissionTemplate(code: string) {
  return missionTemplates.find((template) => template.code === code) ?? missionTemplates[0];
}
