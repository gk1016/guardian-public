import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { passwordSchema } from "@/lib/password-policy";
import { auditLog } from "@/lib/audit";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: passwordSchema,
});

export async function PATCH(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  // Fetch current user record
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    return NextResponse.json(
      { error: "Account not found." },
      { status: 404 },
    );
  }

  // Verify current password
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 403 },
    );
  }

  // Hash new password (cost 12, matching admin route)
  const newHash = await bcrypt.hash(newPassword, 12);

  // Update password
  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: newHash },
  });

  // Resolve orgId for audit log
  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.userId },
    select: { orgId: true },
  });

  await auditLog({
    userId: session.userId,
    orgId: membership?.orgId,
    action: "password_change",
    targetType: "user",
    targetId: session.userId,
    metadata: { self: true },
  });

  return NextResponse.json({ ok: true });
}
