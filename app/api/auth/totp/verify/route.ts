import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyTotp } from "@/lib/totp";
import { auditLog } from "@/lib/audit";

const verifySchema = z.object({
  code: z.string().length(6),
});

/**
 * POST /api/auth/totp/verify
 * Verify a TOTP code to enable MFA for the authenticated user.
 * The user must have already called /api/auth/totp/setup.
 */
export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = verifySchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid code format." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, totpSecret: true, totpEnabled: true },
  });

  if (!user?.totpSecret) {
    return NextResponse.json({ error: "TOTP setup not started. Call /api/auth/totp/setup first." }, { status: 400 });
  }

  if (user.totpEnabled) {
    return NextResponse.json({ error: "TOTP is already enabled." }, { status: 409 });
  }

  if (!verifyTotp(user.totpSecret, payload.data.code)) {
    return NextResponse.json({ error: "Invalid TOTP code." }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true },
  });

  auditLog({
    userId: user.id,
    action: "totp_enabled",
    targetType: "user",
    targetId: user.id,
  });

  return NextResponse.json({ ok: true, message: "TOTP enabled successfully." });
}
