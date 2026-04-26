import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/federation/intel — list intel received from federation peers.
 * Query params:
 *   - source: filter by sourceInstanceName (partial match)
 *   - severity: minimum severity (1-5)
 *   - search: search title/description
 *   - limit: max results (default 50)
 */
export async function GET(request: Request) {
  await requireSession("/intel");

  const url = new URL(request.url);
  const source = url.searchParams.get("source");
  const severity = url.searchParams.get("severity");
  const search = url.searchParams.get("search");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);

  const where: Record<string, unknown> = {};

  if (source) {
    where.sourceInstanceName = { contains: source, mode: "insensitive" };
  }
  if (severity) {
    const sev = parseInt(severity, 10);
    if (sev >= 1 && sev <= 5) {
      where.severity = { gte: sev };
    }
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const items = await prisma.federatedIntel.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ ok: true, items, count: items.length });
}
