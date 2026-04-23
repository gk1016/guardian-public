import { NextResponse } from "next/server";
import { z } from "zod";
import { jwtVerify } from "jose";
import { createSessionToken, getSessionCookieName } from "@/lib/auth-core";
import { prisma } from "@/lib/prisma";
import { verifyTotp } from "@/lib/totp";
import { auditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

const validateSchema = z.object({
  totpToken: z.string().min(1),
  code: z.string().length(6),
});

function getTotpSecret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET || "guardian-dev-secret-change-me",
  );
}

/**
 * POST /api/auth/totp/validate
 * Complete login by validating a TOTP code after password verification.
 * Accepts the short-lived totpToken from the login response + 6-digit code.
 */
export async function POST(request: Request) {
  try {
    const payload = validateSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    // Verify the TOTP token
    let tokenPayload;
    try {
      const result = await jwtVerify(payload.data.totpToken, getTotpSecret());
      tokenPayload = result.payload;
    } catch {
      return NextResponse.json({ error: "TOTP token expired or invalid." }, { status: 401 });
    }

    if (tokenPayload.purpose !== "totp-challenge") {
      return NextResponse.json({ error: "Invalid token type." }, { status: 401 });
    }

    const userId = tokenPayload.sub;
    if (!userId) {
      return NextResponse.json({ error: "Invalid token." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        handle: true,
        role: true,
        displayName: true,
        status: true,
        totpSecret: true,
        totpEnabled: true,
      },
    });

    if (!user?.totpSecret || !user.totpEnabled) {
      return NextResponse.json({ error: "TOTP not configured." }, { status: 400 });
    }

    if (!verifyTotp(user.totpSecret, payload.data.code)) {
      log.warn("TOTP validation failed", { handle: user.handle });
      return NextResponse.json({ error: "Invalid TOTP code." }, { status: 401 });
    }

    // TOTP verified — issue full session
    const membership = await prisma.orgMember.findFirst({
      where: { userId: user.id },
      include: { org: { select: { id: true, tag: true } } },
      orderBy: { joinedAt: "asc" },
    });

    const session = {
      userId: user.id,
      email: user.email,
      handle: user.handle,
      role: user.role,
      displayName: user.displayName ?? undefined,
      status: user.status,
      orgId: membership?.org.id,
      orgTag: membership?.org.tag,
    };

    const token = await createSessionToken(session);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    const response = NextResponse.json({
      ok: true,
      redirectTo: "/command",
      user: {
        handle: user.handle,
        role: user.role,
        displayName: user.displayName,
      },
    });

    response.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    auditLog({
      userId: user.id,
      orgId: membership?.org.id,
      action: "login_totp",
      targetType: "session",
      metadata: { ip, handle: user.handle },
    });

    log.info("TOTP login completed", { handle: user.handle, ip });

    return response;
  } catch (error) {
    log.error("TOTP validation error", {
      err: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "TOTP validation failed." }, { status: 500 });
  }
}
