import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { canManageAdministration } from "@/lib/roles";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

// GET — load recruit config for admin
export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!canManageAdministration(session.role)) {
    return NextResponse.json({ error: "Admin authority required." }, { status: 403 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const config = await prisma.recruitConfig.findUnique({
    where: { orgId: org.id },
  });

  if (!config) {
    return NextResponse.json({
      ok: true,
      headline: "Join the crew.",
      description: "We're looking for new members. Submit an application below.",
      values: [],
      ctaText: "Submit Application",
      isEnabled: false,
    });
  }

  return NextResponse.json({
    ok: true,
    headline: config.headline,
    description: config.description,
    values: config.values,
    ctaText: config.ctaText,
    isEnabled: config.isEnabled,
  });
}

const updateSchema = z.object({
  headline: z.string().trim().max(200),
  description: z.string().trim().max(2000),
  values: z.array(z.string().trim().max(60)).max(20),
  ctaText: z.string().trim().max(50),
  isEnabled: z.boolean(),
});

// PUT — save recruit config
export async function PUT(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!canManageAdministration(session.role)) {
    return NextResponse.json({ error: "Admin authority required." }, { status: 403 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid config data." }, { status: 400 });
  }

  await prisma.recruitConfig.upsert({
    where: { orgId: org.id },
    create: {
      orgId: org.id,
      headline: parsed.data.headline,
      description: parsed.data.description,
      values: parsed.data.values,
      ctaText: parsed.data.ctaText,
      isEnabled: parsed.data.isEnabled,
    },
    update: {
      headline: parsed.data.headline,
      description: parsed.data.description,
      values: parsed.data.values,
      ctaText: parsed.data.ctaText,
      isEnabled: parsed.data.isEnabled,
    },
  });

  await auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "update_recruit_config",
    targetType: "recruit_config",
    targetId: org.id,
    metadata: { isEnabled: parsed.data.isEnabled },
  });

  return NextResponse.json({ ok: true });
}
