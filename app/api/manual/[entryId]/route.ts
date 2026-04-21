import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { canManageOperations } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  category: z.enum(["general", "sop", "procedures", "training", "reference", "guides"]).optional(),
  body: z.string().max(50000).optional(),
});

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { entryId } = await params;
  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const entry = await prisma.manualEntry.findFirst({
    where: { id: entryId, orgId: org.id },
    select: {
      id: true,
      title: true,
      category: true,
      entryType: true,
      body: true,
      fileName: true,
      fileSize: true,
      fileMimeType: true,
      createdAt: true,
      updatedAt: true,
      author: {
        select: { handle: true, displayName: true },
      },
    },
  });

  if (!entry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    entry: {
      ...entry,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      authorDisplay: entry.author.displayName ?? entry.author.handle,
    },
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOperations(session.role)) {
    return NextResponse.json({ error: "Editing requires operations authority." }, { status: 403 });
  }

  const { entryId } = await params;
  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const existing = await prisma.manualEntry.findFirst({
    where: { id: entryId, orgId: org.id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  const payload = updateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid update payload." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (payload.data.title !== undefined) data.title = payload.data.title;
  if (payload.data.category !== undefined) data.category = payload.data.category;
  if (payload.data.body !== undefined) data.body = payload.data.body;

  await prisma.manualEntry.update({
    where: { id: entryId },
    data,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOperations(session.role)) {
    return NextResponse.json({ error: "Deletion requires operations authority." }, { status: 403 });
  }

  const { entryId } = await params;
  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const existing = await prisma.manualEntry.findFirst({
    where: { id: entryId, orgId: org.id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  await prisma.manualEntry.delete({ where: { id: entryId } });
  return NextResponse.json({ ok: true });
}
