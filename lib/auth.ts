import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getSessionCookieName,
  verifySessionToken,
} from "@/lib/auth-core";

export type { GuardianSession } from "@/lib/auth-core";

export async function getSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function requireSession(nextPath?: string) {
  const session = await getSessionFromCookies();
  if (!session) {
    const target = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
    redirect(target);
  }
  return session;
}
