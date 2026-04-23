import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { canManageOperations } from "@/lib/roles";
import { auditLog } from "@/lib/audit";

const dispatchUpdateSchema = z.object({
  status: z.enum(["tasked", "en_route", "on_scene", "rtb", "complete", "aborted"]),
});

type RouteContext = {
  params: Promise<{
    dispatchId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOperations(session.role)) {
    return NextResponse.json({ error: "Dispatch management requires operations authority." }, { status: 403 });
  }

  const payload = dispatchUpdateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid dispatch update payload." }, { status: 400 });
  }

  const { dispatchId } = await params;
  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const dispatch = await prisma.qrfDispatch.findFirst({
    where: {
      id: dispatchId,
      orgId: org.id,
    },
    select: {
      id: true,
      qrfId: true,
      rescueId: true,
      missionId: true,
      qrf: {
        select: {
          callsign: true,
        },
      },
    },
  });

  if (!dispatch) {
    return NextResponse.json({ error: "Dispatch not found." }, { status: 404 });
  }

  const now = new Date();
  const dispatchStatus = payload.data.status;
  const qrfStatus =
    dispatchStatus === "rtb" || dispatchStatus === "complete"
      ? "redcon2"
      : dispatchStatus === "aborted"
        ? "redcon3"
        : dispatchStatus === "tasked"
          ? "tasked"
          : "launched";

  await prisma.$transaction(async (tx) => {
    await tx.qrfDispatch.update({
      where: { id: dispatchId },
      data: {
        status: dispatchStatus,
        arrivedAt: dispatchStatus === "on_scene" ? now : undefined,
        rtbAt: dispatchStatus === "rtb" || dispatchStatus === "complete" || dispatchStatus === "aborted" ? now : undefined,
      },
    });

    await tx.qrfReadiness.update({
      where: { id: dispatch.qrfId },
      data: {
        status: qrfStatus,
      },
    });

    if (dispatch.missionId) {
      await tx.missionLog.create({
        data: {
          missionId: dispatch.missionId,
          authorId: session.userId,
          entryType: "dispatch",
          message: `${dispatch.qrf.callsign} dispatch updated to ${dispatchStatus}.`,
        },
      });
    }

    if (dispatch.rescueId) {
      await tx.rescueRequest.update({
        where: { id: dispatch.rescueId },
        data: {
          status:
            dispatchStatus === "on_scene"
              ? "on_scene"
              : dispatchStatus === "complete"
                ? "closed"
                : dispatchStatus === "en_route"
                  ? "en_route"
                  : dispatchStatus === "aborted"
                    ? "open"
                    : "dispatching",
        },
      });
    }
  });

  await createNotification({
    orgId: org.id,
    createdById: session.userId,
    category: "qrf",
    severity:
      dispatchStatus === "aborted"
        ? "critical"
        : dispatchStatus === "complete" || dispatchStatus === "rtb"
          ? "info"
          : "warning",
    title: `${dispatch.qrf.callsign} / ${dispatchStatus}`,
    body: `${dispatch.qrf.callsign} dispatch state changed to ${dispatchStatus}.`,
    href: "/qrf",
  });

  auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "update",
    targetType: "qrf_dispatch",
    targetId: dispatchId,
    metadata: { callsign: dispatch.qrf.callsign, status: dispatchStatus },
  });

  return NextResponse.json({ ok: true });
}
