import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth-core";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
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
    // Protected API routes (exclude auth + health)
    "/api/missions/:path*",
    "/api/intel/:path*",
    "/api/doctrine/:path*",
    "/api/rescues/:path*",
    "/api/qrf/:path*",
    "/api/incidents/:path*",
    "/api/admin/:path*",
    "/api/notifications/:path*",
  ],
};
