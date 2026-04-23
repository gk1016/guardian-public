import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageMissions } from "@/lib/roles";
import { auditLog } from "@/lib/audit";

const doctrineCreateSchema = z.object({
  code: z.string().trim().min(3).max(40),
  title: z.string().trim().min(4).max(120),
  category: z.string().trim().min(3).max(40),
  summary: z.string().trim().min(12).max(400),
  body: z.string().trim().min(20).max(2400),
  escalation: z.string().trim().max(400).optional(),
  isDefault: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageMissions(session.role)) {
    return NextResponse.json({ error: "Doctrine creation requires command authority." }, { status: 403 });
  }

  const payload = doctrineCreateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid doctrine payload." }, { status: 400 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found for operator." }, { status: 400 });
  }

  const code = payload.data.code.toLowerCase().replaceAll(" ", "_");
  const existingDoctrine = await prisma.doctrineTemplate.findFirst({
    where: {
      orgId: org.id,
      code,
    },
    select: { id: true },
  });

  if (existingDoctrine) {
    return NextResponse.json({ error: "Doctrine code already exists in this organization." }, { status: 409 });
  }

  const doctrine = await prisma.doctrineTemplate.create({
    data: {
      orgId: org.id,
      code,
      title: payload.data.title,
      category: payload.data.category,
      summary: payload.data.summary,
      body: payload.data.body,
      escalation: payload.data.escalation || null,
      isDefault: payload.data.isDefault ?? false,
    },
    select: {
      id: true,
      code: true,
      title: true,
      category: true,
    },
  });

  auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "create",
    targetType: "doctrine",
    targetId: doctrine.id,
    metadata: { code: doctrine.code, title: doctrine.title },
  });

  return NextResponse.json({ ok: true, doctrine });
}
