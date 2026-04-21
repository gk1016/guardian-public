import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageAdministration } from "@/lib/roles";

const createUserSchema = z.object({
  email: z.email(),
  handle: z.string().trim().min(2).max(32),
  displayName: z.string().trim().min(2).max(80),
  password: z.string().min(8).max(128),
  role: z.enum(["pilot", "rescue_coordinator", "director", "admin", "commander"]),
  status: z.enum(["active", "pending", "disabled"]),
  rank: z.string().trim().min(2).max(40),
  title: z.string().trim().max(80).optional(),
});

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageAdministration(session.role)) {
    return NextResponse.json({ error: "Admin authority required." }, { status: 403 });
  }

  const payload = createUserSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid user payload." }, { status: 400 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const email = payload.data.email.toLowerCase();
  const handle = payload.data.handle.replaceAll(/\s+/g, "").toUpperCase();

  const [existingEmail, existingHandle] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.user.findUnique({ where: { handle }, select: { id: true } }),
  ]);

  if (existingEmail) {
    return NextResponse.json({ error: "Email already exists." }, { status: 409 });
  }

  if (existingHandle) {
    return NextResponse.json({ error: "Handle already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(payload.data.password, 10);

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        handle,
        displayName: payload.data.displayName,
        passwordHash,
        role: payload.data.role,
        status: payload.data.status,
      },
      select: {
        id: true,
        handle: true,
        email: true,
      },
    });

    await tx.orgMember.create({
      data: {
        userId: user.id,
        orgId: org.id,
        rank: payload.data.rank,
        title: payload.data.title || payload.data.displayName,
      },
    });

    return user;
  });

  return NextResponse.json({ ok: true, user: created });
}
