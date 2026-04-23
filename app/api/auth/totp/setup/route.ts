import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSecret, totpUri } from "@/lib/totp";
import { auditLog } from "@/lib/audit";

/**
 * POST /api/auth/totp/setup
 * Generate a new TOTP secret for the authenticated user.
 * Returns the secret and otpauth URI for QR code display.
 * Does NOT enable TOTP — user must verify a code first.
 */
export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, handle: true, totpEnabled: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (user.totpEnabled) {
    return NextResponse.json({ error: "TOTP is already enabled. Disable it first to reconfigure." }, { status: 409 });
  }

  const secret = generateSecret();

  // Store the secret (not yet enabled)
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: secret, totpEnabled: false },
  });

  const uri = totpUri({
    secret,
    account: user.email,
    issuer: "Guardian",
  });

  auditLog({
    userId: user.id,
    action: "totp_setup_started",
    targetType: "user",
    targetId: user.id,
  });

  return NextResponse.json({ ok: true, secret, uri });
}
