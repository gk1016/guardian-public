import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { canManageOperations } from "@/lib/roles";

const rescueCreateSchema = z.object({
  survivorHandle: z.string().trim().min(2).max(40),
  locationName: z.string().trim().max(80).optional(),
  urgency: z.enum(["flash", "urgent", "priority", "routine"]),
  threatSummary: z.string().trim().max(400).optional(),
  rescueNotes: z.string().trim().max(2000).optional(),
  survivorCondition: z.string().trim().max(400).optional(),
  escortRequired: z.boolean(),
  medicalRequired: z.boolean(),
  offeredPayment: z.number().int().min(0).max(100000000).optional(),
});

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOperations(session.role)) {
    return NextResponse.json({ error: "Rescue intake requires operations authority." }, { status: 403 });
  }

  const payload = rescueCreateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid rescue payload." }, { status: 400 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const rescue = await prisma.rescueRequest.create({
    data: {
      orgId: org.id,
      requesterId: session.userId,
      survivorHandle: payload.data.survivorHandle.toUpperCase(),
      locationName: payload.data.locationName || null,
      urgency: payload.data.urgency,
      status: "open",
      threatSummary: payload.data.threatSummary || null,
      rescueNotes: payload.data.rescueNotes || null,
      survivorCondition: payload.data.survivorCondition || null,
      escortRequired: payload.data.escortRequired,
      medicalRequired: payload.data.medicalRequired,
      offeredPayment: payload.data.offeredPayment ?? null,
    },
    select: {
      id: true,
      survivorHandle: true,
      status: true,
    },
  });

  await createNotification({
    orgId: org.id,
    createdById: session.userId,
    category: "rescue",
    severity: payload.data.urgency === "flash" ? "critical" : "warning",
    title: `New rescue intake / ${rescue.survivorHandle}`,
    body: `Rescue request opened with status ${rescue.status}. Escort requirement and survivor condition need review.`,
    href: "/rescues",
  });

  return NextResponse.json({ ok: true, rescue });
}
