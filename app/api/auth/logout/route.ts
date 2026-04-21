import { NextResponse } from "next/server";
import { getSessionCookieName } from "@/lib/auth-core";

export async function POST(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const origin = forwardedHost
    ? `${request.headers.get("x-forwarded-proto") || "https"}://${forwardedHost}`
    : new URL(request.url).origin;

  const response = NextResponse.redirect(new URL("/login", origin));
  response.cookies.set({
    name: getSessionCookieName(),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
