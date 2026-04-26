import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public endpoint — no auth required
export async function GET() {
  try {
    // Single-org: grab first org's recruit config
    const org = await prisma.organization.findFirst({
      select: { id: true, name: true },
    });
    if (!org) {
      return NextResponse.json({ ok: false, error: "No organization found." }, { status: 404 });
    }

    const config = await prisma.recruitConfig.findUnique({
      where: { orgId: org.id },
    });

    if (!config) {
      return NextResponse.json({
        ok: true,
        enabled: false,
        orgName: org.name,
        headline: "Join the crew.",
        description: "",
        values: [],
        ctaText: "Submit Application",
      });
    }

    return NextResponse.json({
      ok: true,
      enabled: config.isEnabled,
      orgName: org.name,
      headline: config.headline,
      description: config.description,
      values: config.values,
      ctaText: config.ctaText,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
