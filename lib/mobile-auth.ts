import { verifySessionToken, type GuardianSession } from "@/lib/auth-core";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * Mobile API authentication.
 * Extracts JWT from Authorization: Bearer <token> header,
 * verifies it using the same auth-core as the web app,
 * and performs a live DB check for user validity.
 */
export async function getMobileSession(
  request: Request,
): Promise<GuardianSession | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  if (!token) {
    return null;
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return null;
  }

  // Live DB check — same logic as lib/auth.ts getSessionFromCookies
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { status: true, sessionsInvalidatedAt: true },
  });

  if (!user || user.status !== "active") {
    return null;
  }

  if (
    user.sessionsInvalidatedAt &&
    session.iat &&
    user.sessionsInvalidatedAt.getTime() / 1000 > session.iat
  ) {
    return null;
  }

  return session;
}

/**
 * Require a valid mobile session or return a 401 response.
 * Use in route handlers: const session = await requireMobileSession(request);
 * If session is a NextResponse, return it immediately.
 */
export async function requireMobileSession(
  request: Request,
): Promise<GuardianSession | NextResponse> {
  const session = await getMobileSession(request);
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }
  return session;
}
