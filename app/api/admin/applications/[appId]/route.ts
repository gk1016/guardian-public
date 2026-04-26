import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { canManageAdministration } from "@/lib/roles";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const patchSchema = z.object({
  status: z.enum(["approved", "rejected", "pending"]),
  notes: z.string().trim().max(1000).optional(),
});

// PATCH — update application status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!canManageAdministration(session.role)) {
    return NextResponse.json({ error: "Admin authority required." }, { status: 403 });
  }

  const { appId } = await params;
  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  }

  const app = await prisma.application.findUnique({
    where: { id: appId },
  });
  if (!app || app.orgId !== org.id) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  const updateData: any = { status: parsed.data.status };
  if (parsed.data.notes !== undefined) {
    updateData.notes = parsed.data.notes;
  }

  await prisma.application.update({
    where: { id: appId },
    data: updateData,
  });

  await auditLog({
    userId: session.userId,
    orgId: org.id,
    action: `application_${parsed.data.status}`,
    targetType: "application",
    targetId: appId,
    metadata: { handle: app.handle, name: app.name },
  });

  return NextResponse.json({ ok: true });
}
