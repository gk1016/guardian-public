import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getSessionCookieName,
  verifySessionToken,
} from "@/lib/auth-core";
import { prisma } from "@/lib/prisma";

export type { GuardianSession } from "@/lib/auth-core";

export async function getSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) {
    return null;
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return null;
  }

  // Live DB check: verify user still exists, is still active, and session
  // was not invalidated (e.g. after admin role/status change).
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

export async function requireSession(nextPath?: string) {
  const session = await getSessionFromCookies();
  if (!session) {
    const target = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
    redirect(target);
  }
  return session;
}
