import { jwtVerify, SignJWT, type JWTPayload } from "jose";

const SESSION_COOKIE = "guardian_session";
const SESSION_TTL = "7d";

type GuardianSessionPayload = JWTPayload & {
  sub: string;
  email: string;
  handle: string;
  role: string;
  displayName?: string;
  status: string;
};

export type GuardianSession = {
  userId: string;
  email: string;
  handle: string;
  role: string;
  displayName?: string;
  status: string;
};

function getSessionSecret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET || "guardian-dev-secret-change-me",
  );
}

export async function createSessionToken(session: GuardianSession) {
  return new SignJWT({
    email: session.email,
    handle: session.handle,
    role: session.role,
    displayName: session.displayName,
    status: session.status,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify<GuardianSessionPayload>(
      token,
      getSessionSecret(),
    );

    if (!payload.sub || payload.status !== "active") {
      return null;
    }

    return {
      userId: payload.sub,
      email: payload.email,
      handle: payload.handle,
      role: payload.role,
      displayName: payload.displayName,
      status: payload.status,
    } satisfies GuardianSession;
  } catch {
    return null;
  }
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}
