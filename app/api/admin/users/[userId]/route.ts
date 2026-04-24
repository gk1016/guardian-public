import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageAdministration } from "@/lib/roles";
import { auditLog } from "@/lib/audit";
import { optionalPasswordSchema } from "@/lib/password-policy";

const updateUserSchema = z.object({
  displayName: z.string().trim().max(80).optional(),
  role: z.enum(["pilot", "rescue_coordinator", "director", "admin", "commander"]),
  status: z.enum(["active", "pending", "disabled"]),
  rank: z.string().trim().min(2).max(40),
  title: z.string().trim().max(80).optional(),
  password: optionalPasswordSchema,
});

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageAdministration(session.role)) {
    return NextResponse.json({ error: "Admin authority required." }, { status: 403 });
  }

  const payload = updateUserSchema.safeParse(await request.json());
  if (!payload.success) {
    const pwError = payload.error.issues.find((i) => i.path.includes("password"));
    if (pwError) {
      return NextResponse.json({ error: pwError.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid user update payload." }, { status: 400 });
  }

  const { userId } = await params;
  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const membership = await prisma.orgMember.findFirst({
    where: {
      orgId: org.id,
      userId,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Member not found in this organization." }, { status: 404 });
  }

  // Check if role or status is changing — if so, invalidate existing sessions
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });

  const roleOrStatusChanged =
    currentUser &&
    (currentUser.role !== payload.data.role || currentUser.status !== payload.data.status);

  const passwordHash =
    payload.data.password && payload.data.password.trim().length > 0
      ? await bcrypt.hash(payload.data.password, 12)
      : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        displayName: payload.data.displayName || null,
        role: payload.data.role,
        status: payload.data.status,
        passwordHash,
        // Invalidate all existing sessions when role or status changes
        ...(roleOrStatusChanged && { sessionsInvalidatedAt: new Date() }),
      },
      select: {
        id: true,
        handle: true,
        role: true,
        status: true,
      },
    });

    await tx.orgMember.update({
      where: { id: membership.id },
      data: {
        rank: payload.data.rank,
        title: payload.data.title || null,
      },
    });

    return user;
  });

  auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "update",
    targetType: "user",
    targetId: userId,
    metadata: {
      handle: updated.handle,
      role: payload.data.role,
      status: payload.data.status,
      passwordChanged: !!passwordHash,
      sessionsInvalidated: !!roleOrStatusChanged,
    },
  });

  return NextResponse.json({ ok: true, user: updated });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageAdministration(session.role)) {
    return NextResponse.json({ error: "Admin authority required." }, { status: 403 });
  }

  const { userId } = await params;

  // Prevent self-deletion
  if (userId === session.userId) {
    return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const membership = await prisma.orgMember.findFirst({
    where: {
      orgId: org.id,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Member not found in this organization." }, { status: 404 });
  }

  // Get user info for audit log before deletion
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { handle: true, email: true, role: true },
  });

  await prisma.$transaction(async (tx) => {
    // Delete membership first (FK constraint)
    await tx.orgMember.delete({ where: { id: membership.id } });
    // Delete the user
    await tx.user.delete({ where: { id: userId } });
  });

  auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "delete",
    targetType: "user",
    targetId: userId,
    metadata: {
      handle: targetUser?.handle,
      email: targetUser?.email,
      role: targetUser?.role,
    },
  });

  return NextResponse.json({ ok: true });
}
