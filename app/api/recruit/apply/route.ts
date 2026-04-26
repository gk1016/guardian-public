import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const applySchema = z.object({
  handle: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(128),
  email: z.string().email().max(256).optional(),
  message: z.string().trim().max(2000).optional(),
});

// Public endpoint — no auth required
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = applySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid application data." },
        { status: 400 },
      );
    }

    // Single-org: grab first org
    const org = await prisma.organization.findFirst({
      select: { id: true },
    });
    if (!org) {
      return NextResponse.json(
        { ok: false, error: "No organization found." },
        { status: 404 },
      );
    }

    // Check recruitment is enabled
    const config = await prisma.recruitConfig.findUnique({
      where: { orgId: org.id },
      select: { isEnabled: true },
    });
    if (!config?.isEnabled) {
      return NextResponse.json(
        { ok: false, error: "Recruitment is not currently open." },
        { status: 403 },
      );
    }

    // Check for duplicate pending application by handle
    const existing = await prisma.application.findFirst({
      where: {
        orgId: org.id,
        handle: parsed.data.handle,
        status: "pending",
      },
    });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "You already have a pending application." },
        { status: 409 },
      );
    }

    await prisma.application.create({
      data: {
        orgId: org.id,
        handle: parsed.data.handle,
        name: parsed.data.name,
        email: parsed.data.email ?? null,
        message: parsed.data.message ?? "",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Application failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
