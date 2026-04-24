import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { canManageAdministration } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

const addModelSchema = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1).max(120),
  displayName: z.string().min(1).max(120).optional(),
  category: z.enum(["chat", "reasoning", "code", "fast"]).optional(),
});

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!canManageAdministration(session.role)) {
    return NextResponse.json({ error: "Admin authority required." }, { status: 403 });
  }

  const payload = addModelSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid model data." }, { status: 400 });
  }

  const { provider, modelId, displayName, category } = payload.data;

  const existing = await prisma.aiModelOption.findUnique({
    where: { provider_modelId: { provider, modelId } },
  });

  if (existing) {
    return NextResponse.json({ error: "Model already exists in registry." }, { status: 409 });
  }

  const maxSort = await prisma.aiModelOption.aggregate({
    where: { provider },
    _max: { sortOrder: true },
  });

  const model = await prisma.aiModelOption.create({
    data: {
      provider,
      modelId,
      displayName: displayName || modelId,
      category: category || "chat",
      sortOrder: (maxSort._max.sortOrder ?? 0) + 10,
    },
  });

  return NextResponse.json({ ok: true, model });
}
