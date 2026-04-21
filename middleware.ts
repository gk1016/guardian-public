import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "guardian_session";

// Routes that do NOT require authentication
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/about",
  "/recruit",
  "/standards",
]);

const PUBLIC_API_PREFIXES = [
  "/api/auth/",
  "/api/health",
];

function getSessionSecret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET || "guardian-dev-secret-change-me",
  );
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  for (const prefix of PUBLIC_API_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  // Static assets, Next.js internals
  if (pathname.startsWith("/_next/") || pathname.startsWith("/favicon")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    return denyAccess(request, pathname);
  }

  try {
    const { payload } = await jwtVerify(token, getSessionSecret());

    // Reject inactive accounts even if JWT is valid
    if (payload.status !== "active") {
      return denyAccess(request, pathname);
    }

    return NextResponse.next();
  } catch {
    // Token expired, malformed, or wrong secret
    return denyAccess(request, pathname);
  }
}

function denyAccess(request: NextRequest, pathname: string) {
  // API routes get 401 JSON
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  // Pages redirect to login with return path
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
