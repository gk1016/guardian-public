import { NextResponse } from "next/server";
import { requireMobileSession } from "@/lib/mobile-auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/m/qrf
 * Returns QRF asset readiness for G2 HUD.
 */
export async function GET(request: Request) {
  const session = await requireMobileSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const org = await getOrgForUser(session.userId);
    if (!org) {
      return NextResponse.json({ assets: [] });
    }

    const qrf = await prisma.qrfReadiness.findMany({
      where: { orgId: org.id },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 10,
      select: {
        id: true,
        callsign: true,
        status: true,
        platform: true,
        locationName: true,
        availableCrew: true,
      },
    });

    return NextResponse.json({
      assets: qrf.map((entry) => ({
        id: entry.id,
        name: entry.callsign,
        type: entry.platform ?? "unknown",
        status: entry.status,
        location: entry.locationName,
        crew: entry.availableCrew,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load QRF." },
      { status: 500 },
    );
  }
}
