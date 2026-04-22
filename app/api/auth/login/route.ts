import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, getSessionCookieName } from "@/lib/auth-core";
import { prisma } from "@/lib/prisma";

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
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    // Rate limit by IP
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429 },
      );
    }

    const payload = loginSchema.safeParse(await request.json());
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

    // Look up org membership for the session
    const membership = await prisma.orgMember.findFirst({
      where: { userId: user.id },
      include: { org: { select: { id: true, tag: true } } },
      orderBy: { joinedAt: "asc" },
    });

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      handle: user.handle,
      role: user.role,
      displayName: user.displayName ?? undefined,
      status: user.status,
      orgId: membership?.org.id,
      orgTag: membership?.org.tag,
    });

    const response = NextResponse.json({
      ok: true,
      redirectTo: "/command",
      user: {
        handle: user.handle,
        role: user.role,
        displayName: user.displayName,
      },
    });

    response.cookies.set({
      name: getSessionCookieName(),
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Guardian login failed", error);
    return NextResponse.json(
      { error: "Failed to sign in." },
      { status: 500 },
    );
  }
}
