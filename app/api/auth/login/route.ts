import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { SignJWT } from "jose";
import { createSessionToken, getSessionCookieName } from "@/lib/auth-core";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Per-IP rate limiter — 10 attempts per 15-minute window, no dependencies
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 10;

type RateBucket = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateBucket>();

// Sweep expired buckets every 5 minutes to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (now >= bucket.resetAt) rateBuckets.delete(ip);
  }
}, 5 * 60 * 1000).unref();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);

  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

function getTotpSecret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET || "guardian-dev-secret-change-me",
  );
}
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    if (isRateLimited(ip)) {
      log.warn("Login rate limited", { ip });
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const payload = loginSchema.safeParse(body);

    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid email or password format." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: payload.data.email.toLowerCase() },
    });

    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 },
      );
    }

    const passwordMatches = await bcrypt.compare(
      payload.data.password,
      user.passwordHash,
    );

    if (!passwordMatches || user.status !== "active") {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 },
      );
    }

    // --- TOTP challenge ---
    if (user.totpEnabled && user.totpSecret) {
      // Issue a short-lived TOTP challenge token instead of a session
      const totpToken = await new SignJWT({ purpose: "totp-challenge" })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user.id)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(getTotpSecret());

      log.info("TOTP challenge issued", { handle: user.handle, ip });

      return NextResponse.json({
        ok: true,
        requiresTotp: true,
        totpToken,
      });
    }

    // --- Standard login (no TOTP) ---
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
      action: "login",
      targetType: "session",
      metadata: { ip, handle: user.handle },
    });

    log.info("Login successful", { handle: user.handle, ip });

    return response;
  } catch (error) {
    log.error("Login failed", {
      err: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to sign in." },
      { status: 500 },
    );
  }
}
