import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth-core";
import { prisma } from "@/lib/prisma";

// Cache the "org exists" check so we don't hit the DB on every request.
// Resets after 30 seconds or when setup completes (new page load clears it).
let orgExistsCache: { value: boolean; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

async function hasOrganization(): Promise<boolean> {
  const now = Date.now();
  if (orgExistsCache && now < orgExistsCache.expiresAt) {
    return orgExistsCache.value;
  }
  try {
    const org = await prisma.organization.findFirst({ select: { id: true } });
    const exists = !!org;
    orgExistsCache = { value: exists, expiresAt: now + CACHE_TTL_MS };
    return exists;
  } catch {
    // If DB is unreachable, don't block — let the request through
    return true;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // --- First-run gate: redirect everything to /setup if no org exists ---
  if (pathname === "/setup" || pathname === "/api/setup") {
    // Always allow access to the setup page and its API
    const exists = await hasOrganization();
    if (exists) {
      // Setup already done — redirect away from setup page
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  const orgExists = await hasOrganization();
  if (!orgExists) {
    // No org — redirect to setup (API routes get JSON)
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Setup required.", setupUrl: "/setup" },
        { status: 503 },
      );
    }
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  // --- Normal auth gate ---
  const token = request.cookies.get("guardian_session")?.value;
  const session = token ? await verifySessionToken(token) : null;

  // Already authenticated users hitting /login get redirected to command
  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(new URL("/command", request.url));
    }
    return NextResponse.next();
  }

  // No valid session or account inactive
  if (!session) {
    // API routes get 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    // Pages redirect to login with return path
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Setup gate
    "/setup",
    "/api/setup",
    // Auth gate (redirect to /login if session invalid)
    "/login",
    // Protected page routes
    "/command/:path*",
    "/missions/:path*",
    "/intel/:path*",
    "/doctrine/:path*",
    "/rescues/:path*",
    "/roster/:path*",
    "/qrf/:path*",
    "/incidents/:path*",
    "/admin/:path*",
    "/notifications/:path*",
    "/sitrep/:path*",
    "/aar/:path*",
    "/ops/:path*",
    "/tactical/:path*",
    "/federation/:path*",
    "/settings",
    // Protected API routes (exclude auth + health + engine)
    "/api/missions/:path*",
    "/api/intel/:path*",
    "/api/doctrine/:path*",
    "/api/rescues/:path*",
    "/api/qrf/:path*",
    "/api/incidents/:path*",
    "/api/admin/:path*",
    "/api/notifications/:path*",
    "/api/user/:path*",
  ],
};
