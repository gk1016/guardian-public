import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { manualEntries, qrhEntry } from "./manual-seed-content.mjs";

const prisma = new PrismaClient();

async function main() {
  const demoPassword =
    process.env.GUARDIAN_DEMO_PASSWORD || "GuardianDemo!2026";
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  const org = await prisma.organization.upsert({
    where: { tag: "GUARD" },
    update: {
      name: "Guardian Flight",
      description: "Anti-piracy, rescue, escort, and mission-planning organization.",
      isPublic: true,
    },
    create: {
      name: "Guardian Flight",
      tag: "GUARD",
      description: "Anti-piracy, rescue, escort, and mission-planning organization.",
      isPublic: true,
    },
  });

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "reaper11@guardian.local" },
      update: {
        handle: "REAPER11",
        displayName: "Reaper 11",
        passwordHash,
        role: "commander",
        status: "active",
      },
      create: {
        email: "reaper11@guardian.local",
        handle: "REAPER11",
        displayName: "Reaper 11",
        passwordHash,
        role: "commander",
        status: "active",
      },
    }),
    prisma.user.upsert({
      where: { email: "saber1@guardian.local" },
      update: {
        handle: "SABER1",
        displayName: "Saber 1",
        passwordHash,
        role: "pilot",
        status: "active",
      },
      create: {
        email: "saber1@guardian.local",
        handle: "SABER1",
        displayName: "Saber 1",
        passwordHash,
        role: "pilot",
        status: "active",
      },
    }),
    prisma.user.upsert({
      where: { email: "viking2@guardian.local" },
      update: {
        handle: "VIKING2",
        displayName: "Viking 2",
        passwordHash,
        role: "rescue_coordinator",
        status: "active",
      },
      create: {
        email: "viking2@guardian.local",
        handle: "VIKING2",
        displayName: "Viking 2",
        passwordHash,
        role: "rescue_coordinator",
        status: "active",
      },
    }),
  ]);

  await Promise.all(
    users.map((user) =>
      prisma.orgMember.upsert({
        where: {
          userId_orgId: {
            userId: user.id,
            orgId: org.id,
          },
        },
        update: {
          rank: user.role === "commander" ? "owner" : "member",
          title: user.displayName,
        },
        create: {
          userId: user.id,
          orgId: org.id,
          rank: user.role === "commander" ? "owner" : "member",
          title: user.displayName,
        },
      }),
    ),
  );

  const [reaper, saber, viking] = users;

  const doctrineSeeds = [
    {
      code: "weapons_hold",
      title: "Weapons Hold / Visual PID Required",
      category: "counter-piracy",
      summary:
        "Default civilian-lane posture. Positive identification is required before engagement, with priority on shielding noncombatants and controlling merge geometry.",
      body:
        "1. Hold weapons until hostile intent or hostile act is confirmed. 2. Push civilian traffic clear of the engagement lane before committing. 3. Maintain escort geometry and keep one element free to cover withdrawal or rescue. 4. Log contact, break direction, and hull type for the intel board immediately after merge.",
      escalation:
        "Escalate to Weapons Tight if hostile locks, interdiction posture, or bait-beacon behavior is confirmed in the AO.",
      isDefault: true,
    },
    {
      code: "weapons_tight",
      title: "Weapons Tight / Hostile PID Confirmed",
      category: "escort",
      summary:
        "Use when the threat picture is active and escort traffic is at direct risk. Friendly control and visual discipline remain mandatory.",
      body:
        "1. Engage only confirmed hostile contacts. 2. Preserve convoy integrity over pursuit. 3. One section fixes the threat while the second section screens civilian traffic and rescue assets. 4. Abort chase beyond the AO unless command explicitly retasks the package.",
      escalation:
        "Escalate to Weapons Free only when civilian loss is imminent, rescue assets are under attack, or command releases the package.",
      isDefault: false,
    },
    {
      code: "weapons_free",
      title: "Weapons Free / Rescue Under Fire",
      category: "csar",
      summary:
        "Emergency rescue doctrine for survivor recovery or QRF action under active hostile pressure.",
      body:
        "1. Suppress hostile contacts threatening the rescue corridor immediately. 2. Keep one element tied to the rescue ship and one element disrupting hostile re-attack geometry. 3. Do not let pursuit separate the package from the survivor or the medevac bird. 4. Log damage, survivor status, and egress heading before clear of the AO.",
      escalation:
        "Command review required before extending beyond survivor recovery into broader offensive pursuit.",
      isDefault: false,
    },
  ];

  for (const doctrineSeed of doctrineSeeds) {
    const existingDoctrine = await prisma.doctrineTemplate.findFirst({
      where: {
        orgId: org.id,
        code: doctrineSeed.code,
      },
    });

    if (existingDoctrine) {
      await prisma.doctrineTemplate.update({
        where: { id: existingDoctrine.id },
        data: doctrineSeed,
      });
    } else {
      await prisma.doctrineTemplate.create({
        data: {
          orgId: org.id,
          ...doctrineSeed,
        },
      });
    }
  }

  const missionSeedDefinitions = [
    {
      callsign: "REAPER 11",
      title: "Convoy Escort for High-Risk Medical Lift",
      missionType: "escort",
      status: "ready",
      priority: "priority",
      areaOfOperation: "Stanton / OM-5 to Seraphim corridor",
      missionBrief:
        "Escort a vulnerable logistics lift through a corridor with repeated pirate interdiction reports.",
      roeCode: "weapons_tight",
      leadId: reaper.id,
      phases: [
        "Marshal",
        "Escort Linkup",
        "Transit",
        "Threat Intercept",
        "Recovery",
      ],
    },
    {
      callsign: "GUARD 21",
      title: "Priority Rescue Package for Downed Pilot",
      missionType: "csar",
      status: "active",
      priority: "flash",
      areaOfOperation: "Daymar / Wolf Point approach",
      missionBrief:
        "Recover survivor and escort damaged hull clear of known hostile loiter area.",
      roeCode: "weapons_free",
      leadId: viking.id,
      phases: ["Alert", "Launch", "Escort Join", "Extract", "Egress"],
    },
    {
      callsign: "LANCER 06",
      title: "Threat Reconnaissance of Pirate Holding Area",
      missionType: "recon",
      status: "planning",
      priority: "routine",
      areaOfOperation: "Crusader / Yela belt edge",
      missionBrief:
        "Confirm recent contact reports, identify repeated ambush geometry, and refine route guidance.",
      roeCode: "weapons_hold",
      leadId: saber.id,
      phases: ["Pre-brief", "Ingress", "Observe", "Report", "RTB"],
    },
  ];

  const missions = [];
  for (const missionSeed of missionSeedDefinitions) {
    const existingMission = await prisma.mission.findFirst({
      where: {
        orgId: org.id,
        callsign: missionSeed.callsign,
      },
    });

    const mission = existingMission
      ? await prisma.mission.update({
          where: { id: existingMission.id },
          data: missionSeed,
        })
      : await prisma.mission.create({
          data: {
            orgId: org.id,
            ...missionSeed,
          },
        });

    missions.push(mission);
  }

  const missionParticipants = [
    {
      missionCallsign: "REAPER 11",
      handle: "REAPER11",
      role: "mission lead",
      platform: "F7A Mk II",
      status: "ready",
      notes: "Own escort package and keep the convoy intact.",
    },
    {
      missionCallsign: "REAPER 11",
      handle: "SABER1",
      role: "escort wing",
      platform: "F8C Lightning",
      status: "ready",
      notes: "Hold high cover and break pirate intercept geometry.",
    },
    {
      missionCallsign: "GUARD 21",
      handle: "VIKING2",
      role: "rescue coordinator",
      platform: "Cutlass Red",
      status: "launched",
      notes: "Own survivor pickup and coordinate egress route.",
    },
  ];

  for (const participantSeed of missionParticipants) {
    const mission = missions.find(
      (missionRecord) => missionRecord.callsign === participantSeed.missionCallsign,
    );

    if (!mission) {
      continue;
    }

    const existingParticipant = await prisma.missionParticipant.findFirst({
      where: {
        missionId: mission.id,
        handle: participantSeed.handle,
        role: participantSeed.role,
      },
    });

    if (!existingParticipant) {
      await prisma.missionParticipant.create({
        data: {
          missionId: mission.id,
          handle: participantSeed.handle,
          role: participantSeed.role,
          platform: participantSeed.platform,
          status: participantSeed.status,
          notes: participantSeed.notes,
        },
      });
    }
  }

  const missionLogs = [
    {
      missionCallsign: "REAPER 11",
      authorId: reaper.id,
      entryType: "command",
      message: "Escort package brief complete. Convoy launch window remains green.",
    },
    {
      missionCallsign: "REAPER 11",
      authorId: saber.id,
      entryType: "contact",
      message: "Two hostile contacts reported near the Seraphim lane. Expect intercept geometry on egress.",
    },
    {
      missionCallsign: "GUARD 21",
      authorId: viking.id,
      entryType: "status",
      message: "Rescue bird launched. Survivor beacon intermittent but still viable.",
    },
  ];

  for (const logSeed of missionLogs) {
    const mission = missions.find(
      (missionRecord) => missionRecord.callsign === logSeed.missionCallsign,
    );

    if (!mission) {
      continue;
    }

    const existingLog = await prisma.missionLog.findFirst({
      where: {
        missionId: mission.id,
        entryType: logSeed.entryType,
        message: logSeed.message,
      },
    });

    if (!existingLog) {
      await prisma.missionLog.create({
        data: {
          missionId: mission.id,
          authorId: logSeed.authorId,
          entryType: logSeed.entryType,
          message: logSeed.message,
        },
      });
    }
  }

  const intelSeeds = [
    {
      reportType: "pirate_sighting",
      title: "Interdiction pack working common convoy lane",
      description:
        "Three-ship hostile cell observed loitering near the medical convoy corridor with repeated pull-and-finish behavior.",
      severity: 5,
      locationName: "Seraphim transit lane",
      hostileGroup: "Unknown pirate cell",
      confidence: "high",
      tags: ["pirates", "convoy", "interdiction"],
      isActive: true,
      isVerified: true,
    },
    {
      reportType: "route_hazard",
      title: "Bait distress calls likely being used as lure",
      description:
        "Recent rescue traffic suggests false distress beacons are being used to pull solo responders into kill boxes.",
      severity: 4,
      locationName: "Daymar / Wolf Point",
      hostileGroup: "Unconfirmed",
      confidence: "medium",
      tags: ["csar", "trap", "beacon"],
      isActive: true,
      isVerified: false,
    },
    {
      reportType: "ganker_activity",
      title: "Repeat contact reports near orbital departure lanes",
      description:
        "Fast movers repeatedly engaging underprepared haulers on departure from major hubs.",
      severity: 3,
      locationName: "Crusader orbital exits",
      hostileGroup: "Mixed opportunists",
      confidence: "medium",
      tags: ["gankers", "departure", "haulers"],
      isActive: true,
      isVerified: false,
    },
  ];

  for (const intelSeed of intelSeeds) {
    const existingIntel = await prisma.intelReport.findFirst({
      where: {
        orgId: org.id,
        title: intelSeed.title,
      },
    });

    if (existingIntel) {
      await prisma.intelReport.update({
        where: { id: existingIntel.id },
        data: intelSeed,
      });
    } else {
      await prisma.intelReport.create({
        data: {
          orgId: org.id,
          ...intelSeed,
        },
      });
    }
  }

  const existingRescue = await prisma.rescueRequest.findFirst({
    where: {
      orgId: org.id,
      survivorHandle: "ORBITER-4",
    },
  });

  if (existingRescue) {
    await prisma.rescueRequest.update({
      where: { id: existingRescue.id },
      data: {
        requesterId: saber.id,
        operatorId: viking.id,
        locationName: "Daymar / Wolf Point approach",
        status: "en_route",
        urgency: "urgent",
        threatSummary: "Possible hostile overwatch in area. Escort required.",
        rescueNotes: "Damaged ship, limited mobility, beacon intermittent.",
        survivorCondition: "Minor injuries, degraded quantum drive, low fuel.",
        outcomeSummary: null,
        escortRequired: true,
        medicalRequired: true,
        offeredPayment: 250000,
        roeCode: "weapons_free",
      },
    });
  } else {
    await prisma.rescueRequest.create({
      data: {
        orgId: org.id,
        requesterId: saber.id,
        operatorId: viking.id,
        survivorHandle: "ORBITER-4",
        locationName: "Daymar / Wolf Point approach",
        status: "en_route",
        urgency: "urgent",
        threatSummary: "Possible hostile overwatch in area. Escort required.",
        rescueNotes: "Damaged ship, limited mobility, beacon intermittent.",
        survivorCondition: "Minor injuries, degraded quantum drive, low fuel.",
        outcomeSummary: null,
        escortRequired: true,
        medicalRequired: true,
        offeredPayment: 250000,
        roeCode: "weapons_free",
      },
    });
  }

  const qrfSeeds = [
    {
      callsign: "SABER 1",
      status: "redcon2",
      platform: "F7A Mk II",
      locationName: "Seraphim",
      availableCrew: 1,
      notes: "Launch in five.",
    },
    {
      callsign: "VIKING 2",
      status: "redcon3",
      platform: "Cutlass Red",
      locationName: "Guardian watch floor",
      availableCrew: 2,
      notes: "Medical package standing by.",
    },
    {
      callsign: "HAWK 5",
      status: "redcon2",
      platform: "Ares Inferno",
      locationName: "Everus Harbor",
      availableCrew: 1,
      notes: "Strike escort available.",
    },
  ];

  for (const qrfSeed of qrfSeeds) {
    const existingQrf = await prisma.qrfReadiness.findFirst({
      where: {
        orgId: org.id,
        callsign: qrfSeed.callsign,
      },
    });

    if (existingQrf) {
      await prisma.qrfReadiness.update({
        where: { id: existingQrf.id },
        data: qrfSeed,
      });
    } else {
      await prisma.qrfReadiness.create({
        data: {
          orgId: org.id,
          ...qrfSeed,
        },
      });
    }
  }

  const qrfAssets = await prisma.qrfReadiness.findMany({
    where: { orgId: org.id },
  });

  const saberQrf = qrfAssets.find((entry) => entry.callsign === "SABER 1");
  const vikingQrf = qrfAssets.find((entry) => entry.callsign === "VIKING 2");
  const guardMission = missions.find((mission) => mission.callsign === "GUARD 21");
  const reaperMission = missions.find((mission) => mission.callsign === "REAPER 11");
  const orbiterRescue = await prisma.rescueRequest.findFirst({
    where: {
      orgId: org.id,
      survivorHandle: "ORBITER-4",
    },
  });

  if (vikingQrf && orbiterRescue) {
    const existingDispatch = await prisma.qrfDispatch.findFirst({
      where: {
        qrfId: vikingQrf.id,
        rescueId: orbiterRescue.id,
      },
    });

    const dispatchData = {
      orgId: org.id,
      missionId: guardMission?.id ?? null,
      dispatchedById: reaper.id,
      status: "en_route",
      notes: "Medical bird launched with escort screen pending final handoff.",
      arrivedAt: null,
      rtbAt: null,
    };

    if (existingDispatch) {
      await prisma.qrfDispatch.update({
        where: { id: existingDispatch.id },
        data: dispatchData,
      });
    } else {
      await prisma.qrfDispatch.create({
        data: {
          qrfId: vikingQrf.id,
          rescueId: orbiterRescue.id,
          ...dispatchData,
        },
      });
    }
  }

  if (saberQrf && reaperMission) {
    const existingDispatch = await prisma.qrfDispatch.findFirst({
      where: {
        qrfId: saberQrf.id,
        missionId: reaperMission.id,
      },
    });

    if (!existingDispatch) {
      await prisma.qrfDispatch.create({
        data: {
          orgId: org.id,
          qrfId: saberQrf.id,
          missionId: reaperMission.id,
          dispatchedById: reaper.id,
          status: "tasked",
          notes: "Escort element standing by to cover convoy departure window.",
        },
      });
    }
  }

  const incidentSeeds = [
    {
      title: "False distress beacon used to pull responders off route",
      category: "rescue-trap",
      severity: 4,
      status: "open",
      summary:
        "Responder package observed a likely bait beacon positioned to drag solo pilots into a prepared kill box near Wolf Point.",
      lessonsLearned:
        "Do not commit solo rescue traffic into an unvetted beacon. Pair intake review with the live threat board before launch.",
      actionItems:
        "Keep escort mandatory on high-risk Daymar pickups and cross-check distress traffic against recent hostile sightings.",
      publicSummary:
        "Guardian identified a probable bait beacon pattern near Wolf Point and adjusted escort posture before committing rescue traffic.",
      reporterId: viking.id,
      reviewerId: reaper.id,
      missionId: guardMission?.id ?? null,
      rescueId: orbiterRescue?.id ?? null,
      closedAt: null,
    },
    {
      title: "Convoy intercept geometry forced escort split",
      category: "contact",
      severity: 3,
      status: "closed",
      summary:
        "Escort package had to split high and low cover to keep the convoy intact after hostile contacts bracketed the lane.",
      lessonsLearned:
        "Reserve element positioning mattered more than outright speed. The convoy survived because one section stayed disciplined instead of chasing.",
      actionItems:
        "Seed reserve escort slots by default on medical-lift profiles and tighten merge comm brevity.",
      publicSummary:
        "Guardian reviewed a convoy escort engagement and tightened reserve-element doctrine after the package held formation under pressure.",
      reporterId: reaper.id,
      reviewerId: reaper.id,
      missionId: reaperMission?.id ?? null,
      rescueId: null,
      closedAt: new Date(),
    },
  ];

  for (const incidentSeed of incidentSeeds) {
    const existingIncident = await prisma.incident.findFirst({
      where: {
        orgId: org.id,
        title: incidentSeed.title,
      },
    });

    if (existingIncident) {
      await prisma.incident.update({
        where: { id: existingIncident.id },
        data: {
          ...incidentSeed,
          orgId: org.id,
        },
      });
    } else {
      await prisma.incident.create({
        data: {
          orgId: org.id,
          ...incidentSeed,
        },
      });
    }
  }

  const notificationSeeds = [
    {
      category: "qrf",
      severity: "warning",
      title: "VIKING 2 remains committed to active CSAR tasking",
      body: "Medical package is already moving toward ORBITER-4. Do not count that asset as free for unrelated dispatch.",
      href: "/qrf",
    },
    {
      category: "incident",
      severity: "critical",
      title: "False distress beacon pattern remains unresolved",
      body: "Rescue trap incident is still open. Escort remains mandatory on Daymar pickups until that contact pattern is burned down.",
      href: "/incidents",
    },
    {
      category: "rescue",
      severity: "info",
      title: "ORBITER-4 rescue remains in progress",
      body: "Survivor beacon is still active and the rescue package has not yet filed final outcome.",
      href: "/rescues",
    },
  ];

  for (const notificationSeed of notificationSeeds) {
    const existingNotification = await prisma.notification.findFirst({
      where: {
        orgId: org.id,
        title: notificationSeed.title,
      },
    });

    if (existingNotification) {
      await prisma.notification.update({
        where: { id: existingNotification.id },
        data: notificationSeed,
      });
    } else {
      await prisma.notification.create({
        data: {
          orgId: org.id,
          createdById: reaper.id,
          ...notificationSeed,
        },
      });
    }
  }

  // --- Manual entries (operational manual + QRH) ---
  const allManualEntries = [...manualEntries, qrhEntry];

  for (const entry of allManualEntries) {
    const existing = await prisma.manualEntry.findFirst({
      where: {
        orgId: org.id,
        title: entry.title,
      },
    });

    const data = {
      orgId: org.id,
      authorId: reaper.id,
      title: entry.title,
      category: entry.category,
      body: entry.body,
      entryType: "article",
    };

    if (existing) {
      await prisma.manualEntry.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.manualEntry.create({ data });
    }
  }


  // --- AI System Documentation (.docx bundled file) ---
  const aiDocPath = new URL("./assets/Guardian_AI_System_Documentation.docx", import.meta.url);
  try {
    const fs = await import("node:fs");
    const mammothLib = await import("mammoth");
    const docBuffer = fs.readFileSync(aiDocPath);
    const htmlResult = await mammothLib.default.convertToHtml({ buffer: docBuffer });
    const plainResult = await mammothLib.default.extractRawText({ buffer: docBuffer });
    const aiDocBody = htmlResult.value || plainResult.value || "";

    const aiDocTitle = "Guardian AI System Documentation";
    const existingAiDoc = await prisma.manualEntry.findFirst({
      where: { orgId: org.id, title: aiDocTitle },
    });

    const aiDocData = {
      orgId: org.id,
      authorId: reaper.id,
      title: aiDocTitle,
      category: "reference",
      entryType: "file",
      body: aiDocBody,
      fileName: "Guardian_AI_System_Documentation.docx",
      fileSize: docBuffer.length,
      fileMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileData: docBuffer,
    };

    if (existingAiDoc) {
      await prisma.manualEntry.update({ where: { id: existingAiDoc.id }, data: aiDocData });
    } else {
      await prisma.manualEntry.create({ data: aiDocData });
    }
    console.log("  AI System Documentation seeded.");
  } catch (err) {
    console.log("  AI System Documentation skipped (file not found or mammoth error):", err.message);
  }


  // --- AI System Documentation (.docx bundled file) ---
  const aiDocPath = new URL("./assets/Guardian_AI_System_Documentation.docx", import.meta.url);
  try {
    const fs = await import("node:fs");
    const mammothLib = await import("mammoth");
    const docBuffer = fs.readFileSync(aiDocPath);
    const htmlResult = await mammothLib.default.convertToHtml({ buffer: docBuffer });
    const plainResult = await mammothLib.default.extractRawText({ buffer: docBuffer });
    const aiDocBody = htmlResult.value || plainResult.value || "";

    const aiDocTitle = "Guardian AI System Documentation";
    const existingAiDoc = await prisma.manualEntry.findFirst({
      where: { orgId: org.id, title: aiDocTitle },
    });

    const aiDocData = {
      orgId: org.id,
      authorId: reaper.id,
      title: aiDocTitle,
      category: "reference",
      entryType: "file",
      body: aiDocBody,
      fileName: "Guardian_AI_System_Documentation.docx",
      fileSize: docBuffer.length,
      fileMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileData: docBuffer,
    };

    if (existingAiDoc) {
      await prisma.manualEntry.update({ where: { id: existingAiDoc.id }, data: aiDocData });
    } else {
      await prisma.manualEntry.create({ data: aiDocData });
    }
    console.log("  AI System Documentation seeded.");
  } catch (err) {
    console.log("  AI System Documentation skipped (file not found or mammoth error):", err.message);
  }

  console.log("Guardian seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
