import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { canManageOperations } from "@/lib/roles";
import { auditLog } from "@/lib/audit";

const dispatchCreateSchema = z
  .object({
    missionId: z.string().trim().min(1).optional(),
    rescueId: z.string().trim().min(1).optional(),
    notes: z.string().trim().max(400).optional(),
  })
  .refine((value) => Boolean(value.missionId) !== Boolean(value.rescueId), {
    message: "Dispatch requires exactly one target.",
  });

type RouteContext = {
  params: Promise<{
    qrfId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOperations(session.role)) {
    return NextResponse.json({ error: "Dispatch requires operations authority." }, { status: 403 });
  }

  const payload = dispatchCreateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid dispatch payload." }, { status: 400 });
  }

  const { qrfId } = await params;
  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const qrf = await prisma.qrfReadiness.findFirst({
    where: {
      id: qrfId,
      orgId: org.id,
    },
    select: { id: true, callsign: true },
  });

  if (!qrf) {
    return NextResponse.json({ error: "QRF asset not found." }, { status: 404 });
  }

  if (payload.data.missionId) {
    const mission = await prisma.mission.findFirst({
      where: {
        id: payload.data.missionId,
        orgId: org.id,
      },
      select: { id: true, callsign: true },
    });

    if (!mission) {
      return NextResponse.json({ error: "Mission target not found." }, { status: 404 });
    }
  }

  if (payload.data.rescueId) {
    const rescue = await prisma.rescueRequest.findFirst({
      where: {
        id: payload.data.rescueId,
        orgId: org.id,
      },
      select: { id: true },
    });

    if (!rescue) {
      return NextResponse.json({ error: "Rescue target not found." }, { status: 404 });
    }
  }

  const dispatch = await prisma.$transaction(async (tx) => {
    const createdDispatch = await tx.qrfDispatch.create({
      data: {
        orgId: org.id,
        qrfId,
        missionId: payload.data.missionId ?? null,
        rescueId: payload.data.rescueId ?? null,
        dispatchedById: session.userId,
        status: "tasked",
        notes: payload.data.notes || null,
      },
      select: {
        id: true,
        status: true,
      },
    });

    await tx.qrfReadiness.update({
      where: { id: qrfId },
      data: {
        status: "tasked",
      },
    });

    if (payload.data.missionId) {
      await tx.missionLog.create({
        data: {
          missionId: payload.data.missionId,
          authorId: session.userId,
          entryType: "dispatch",
          message: `${qrf.callsign} tasked to sortie.`,
        },
      });
    }

    if (payload.data.rescueId) {
      await tx.rescueRequest.update({
        where: { id: payload.data.rescueId },
        data: {
          status: "dispatching",
        },
      });
    }

    return createdDispatch;
  });

  await createNotification({
    orgId: org.id,
    createdById: session.userId,
    category: "qrf",
    severity: "warning",
    title: `${qrf.callsign} dispatched`,
    body: payload.data.missionId
      ? `${qrf.callsign} has been tasked to a mission package.`
      : `${qrf.callsign} has been tasked to a rescue package.`,
    href: "/qrf",
  });

  auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "dispatch",
    targetType: "qrf_dispatch",
    targetId: dispatch.id,
    metadata: { qrfId, callsign: qrf.callsign, missionId: payload.data.missionId, rescueId: payload.data.rescueId },
  });

  return NextResponse.json({ ok: true, dispatch });
}
