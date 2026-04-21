import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { canManageOperations } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

const createArticleSchema = z.object({
  title: z.string().trim().min(2).max(200),
  category: z.enum(["general", "sop", "procedures", "training", "reference", "guides"]),
  body: z.string().min(1).max(50000),
});

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const url = new URL(request.url);
  const category = url.searchParams.get("category");

  const where: Record<string, unknown> = { orgId: org.id };
  if (category && category !== "all") where.category = category;

  const entries = await prisma.manualEntry.findMany({
    where,
    orderBy: [{ category: "asc" }, { updatedAt: "desc" }],
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
        select: {
          handle: true,
          displayName: true,
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    items: entries.map((e) => ({
      ...e,
      body: e.entryType === "article" ? e.body : "",
      bodyPreview: e.body.slice(0, 200),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      authorDisplay: e.author.displayName ?? e.author.handle,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOperations(session.role)) {
    return NextResponse.json({ error: "Manual authoring requires operations authority." }, { status: 403 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  // File upload via FormData
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const title = (formData.get("title") as string)?.trim();
    const category = (formData.get("category") as string) ?? "general";
    const file = formData.get("file") as File | null;

    if (!title || title.length < 2) {
      return NextResponse.json({ error: "Title is required (min 2 chars)." }, { status: 400 });
    }

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "File is required for upload." }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 10MB limit." }, { status: 400 });
    }

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
      "text/markdown",
      "image/png",
      "image/jpeg",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: `File type ${file.type} not allowed.` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const entry = await prisma.manualEntry.create({
      data: {
        orgId: org.id,
        authorId: session.userId,
        title,
        category,
        entryType: "file",
        body: "",
        fileName: file.name,
        fileSize: file.size,
        fileMimeType: file.type,
        fileData: buffer,
      },
    });

    return NextResponse.json({ ok: true, entry: { id: entry.id } });
  }

  // JSON article creation
  const payload = createArticleSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid article payload." }, { status: 400 });
  }

  const entry = await prisma.manualEntry.create({
    data: {
      orgId: org.id,
      authorId: session.userId,
      title: payload.data.title,
      category: payload.data.category,
      entryType: "article",
      body: payload.data.body,
    },
  });

  return NextResponse.json({ ok: true, entry: { id: entry.id } });
}
