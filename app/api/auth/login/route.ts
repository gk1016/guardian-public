import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, getSessionCookieName } from "@/lib/auth-core";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
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
