import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { canManageAdministration } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

type RouteContext = {
  params: Promise<{
    ruleId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageAdministration(session.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { ruleId } = await context.params;
  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const body = await request.json();

  // Only allow updating specific fields
  const allowedFields = ["name", "metric", "operator", "threshold", "severity", "isEnabled", "cooldownMinutes"];
  const updateData: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) {
      updateData[key] = body[key];
    }
  }

  if (updateData.threshold !== undefined) {
    updateData.threshold = parseFloat(updateData.threshold as string);
  }
  if (updateData.cooldownMinutes !== undefined) {
    updateData.cooldownMinutes = parseInt(updateData.cooldownMinutes as string);
  }

  const rule = await prisma.alertRule.update({
    where: { id: ruleId },
    data: updateData,
  });

  auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "update",
    targetType: "alert_rule",
    targetId: ruleId,
    metadata: updateData,
  });

  return NextResponse.json({ rule });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageAdministration(session.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { ruleId } = await context.params;
  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  await prisma.alertRule.delete({ where: { id: ruleId } });

  auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "delete",
    targetType: "alert_rule",
    targetId: ruleId,
  });

  return NextResponse.json({ ok: true });
}
