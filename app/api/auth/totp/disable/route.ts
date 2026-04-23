import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const disableSchema = z.object({
  password: z.string().min(1),
});

/**
 * POST /api/auth/totp/disable
 * Disable TOTP MFA. Requires current password for confirmation.
 */
export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = disableSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Password required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, passwordHash: true, totpEnabled: true },
  });

  if (!user?.passwordHash) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (!user.totpEnabled) {
    return NextResponse.json({ error: "TOTP is not enabled." }, { status: 400 });
  }

  const passwordValid = await bcrypt.compare(payload.data.password, user.passwordHash);
  if (!passwordValid) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: null, totpEnabled: false },
  });

  auditLog({
    userId: user.id,
    action: "totp_disabled",
    targetType: "user",
    targetId: user.id,
  });

  return NextResponse.json({ ok: true, message: "TOTP disabled." });
}
