import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

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

  await prisma.missionParticipant.deleteMany();
  await prisma.mission.deleteMany({ where: { orgId: org.id } });
  await prisma.intelReport.deleteMany({ where: { orgId: org.id } });
  await prisma.rescueRequest.deleteMany({ where: { orgId: org.id } });
  await prisma.qrfReadiness.deleteMany({ where: { orgId: org.id } });

  const [reaper, saber, viking] = users;

  const missions = await Promise.all([
    prisma.mission.create({
      data: {
        orgId: org.id,
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
    }),
    prisma.mission.create({
      data: {
        orgId: org.id,
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
    }),
    prisma.mission.create({
      data: {
        orgId: org.id,
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
    }),
  ]);

  await Promise.all([
    prisma.missionParticipant.createMany({
      data: [
        {
          missionId: missions[0].id,
          handle: "REAPER11",
          role: "mission lead",
          platform: "F7A Mk II",
          status: "accepted",
        },
        {
          missionId: missions[0].id,
          handle: "SABER1",
          role: "escort wing",
          platform: "F8C Lightning",
          status: "accepted",
        },
        {
          missionId: missions[1].id,
          handle: "VIKING2",
          role: "rescue coordinator",
          platform: "Cutlass Red",
          status: "accepted",
        },
      ],
    }),
    prisma.intelReport.createMany({
      data: [
        {
          orgId: org.id,
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
          orgId: org.id,
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
          orgId: org.id,
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
      ],
    }),
    prisma.rescueRequest.create({
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
        escortRequired: true,
        medicalRequired: true,
        offeredPayment: 250000,
        roeCode: "weapons_free",
      },
    }),
    prisma.qrfReadiness.createMany({
      data: [
        {
          orgId: org.id,
          callsign: "SABER 1",
          status: "redcon2",
          platform: "F7A Mk II",
          locationName: "Seraphim",
          availableCrew: 1,
          notes: "Launch in five.",
        },
        {
          orgId: org.id,
          callsign: "VIKING 2",
          status: "redcon3",
          platform: "Cutlass Red",
          locationName: "Guardian watch floor",
          availableCrew: 2,
          notes: "Medical package standing by.",
        },
        {
          orgId: org.id,
          callsign: "HAWK 5",
          status: "redcon2",
          platform: "Ares Inferno",
          locationName: "Everus Harbor",
          availableCrew: 1,
          notes: "Strike escort available.",
        },
      ],
    }),
  ]);

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
