import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { canManageAdministration } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!canManageAdministration(session.role)) {
    return NextResponse.json({ error: "Admin authority required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");

  const where = provider ? { provider } : {};

  const models = await prisma.aiModelOption.findMany({
    where,
    orderBy: [{ provider: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      provider: true,
      modelId: true,
      displayName: true,
      category: true,
      isDefault: true,
    },
  });

  return NextResponse.json({ models });
}
