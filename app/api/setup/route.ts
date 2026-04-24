import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { passwordSchema } from "@/lib/password-policy";
import { log } from "@/lib/logger";

const setupSchema = z.object({
  orgName: z.string().min(2).max(100),
  orgTag: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9]+$/, "Tag must be uppercase letters and numbers only"),
  orgDescription: z.string().max(500).optional(),
  email: z.string().email(),
  handle: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[A-Za-z0-9_]+$/, "Handle must be alphanumeric (underscores allowed)"),
  displayName: z.string().min(1).max(100),
  password: passwordSchema,
});

export async function POST(request: Request) {
  try {
    // Guard: only works when no organization exists
    const existingOrg = await prisma.organization.findFirst({
      select: { id: true },
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: "Setup has already been completed." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = setupSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid input." },
        { status: 400 },
      );
    }

    const { orgName, orgTag, orgDescription, email, handle, displayName, password } = parsed.data;

    // Check for duplicate email or handle
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email: email.toLowerCase() }, { handle: handle.toUpperCase() }] },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with that email or handle already exists." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create org, user, and membership in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: orgName,
          tag: orgTag.toUpperCase(),
          description: orgDescription || null,
          isPublic: true,
        },
      });

      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          handle: handle.toUpperCase(),
          displayName,
          passwordHash,
          role: "commander",
          status: "active",
        },
      });

      await tx.orgMember.create({
        data: {
          userId: user.id,
          orgId: org.id,
          rank: "commander",
          title: "Organization Commander",
        },
      });

      return { orgId: org.id, orgTag: org.tag, userId: user.id, handle: user.handle };
    });

    log.info("First-run setup completed", {
      orgId: result.orgId,
      orgTag: result.orgTag,
      handle: result.handle,
    });

    return NextResponse.json({
      ok: true,
      message: "Organization created. You can now sign in.",
    });
  } catch (error) {
    log.error("Setup failed", {
      err: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Setup failed. Check server logs." },
      { status: 500 },
    );
  }
}
