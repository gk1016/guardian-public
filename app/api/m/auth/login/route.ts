import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken } from "@/lib/auth-core";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { log } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Per-IP rate limiter — 10 attempts per 15-minute window
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

type RateBucket = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateBucket>();

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

// ---------------------------------------------------------------------------

const loginSchema = z.object({
  // Accept either email or username field — G2 app sends username
  email: z.string().min(1).max(256).optional(),
  username: z.string().min(1).max(256).optional(),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    if (isRateLimited(ip)) {
      log.warn("Mobile login rate limited", { ip });
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const payload = loginSchema.safeParse(body);

    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid credentials format." },
        { status: 400 },
      );
    }

    // Resolve the login identifier — prefer email, fall back to username
    const identifier = (payload.data.email || payload.data.username || "")
      .trim()
      .toLowerCase();

    if (!identifier) {
      return NextResponse.json(
        { error: "Email or username required." },
        { status: 400 },
      );
    }

    // Look up by email first, then by handle
    let user = await prisma.user.findUnique({
      where: { email: identifier },
    });

    if (!user) {
      // Try handle lookup (case-insensitive via lower)
      user = await prisma.user.findFirst({
        where: {
          handle: {
            equals: identifier,
            mode: "insensitive",
          },
        },
      });
    }

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

    // TOTP is not supported on mobile/G2 — if TOTP is enabled, deny login
    if (user.totpEnabled && user.totpSecret) {
      return NextResponse.json(
        { error: "TOTP-protected accounts cannot use mobile login. Disable TOTP or use web interface." },
        { status: 403 },
      );
    }

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

    auditLog({
      userId: user.id,
      orgId: membership?.org.id,
      action: "mobile_login",
      targetType: "session",
      metadata: { ip, handle: user.handle, client: "g2" },
    });

    log.info("Mobile login successful", { handle: user.handle, ip });

    return NextResponse.json({
      token,
      role: user.role,
      handle: user.handle,
      displayName: user.displayName,
    });
  } catch (error) {
    log.error("Mobile login failed", {
      err: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to sign in." },
      { status: 500 },
    );
  }
}
