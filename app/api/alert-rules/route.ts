import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { canManageAdministration } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const rules = await prisma.alertRule.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageAdministration(session.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const body = await request.json();
  const { name, metric, operator, threshold, severity, cooldownMinutes } = body;

  if (!name || !metric || !operator || threshold === undefined) {
    return NextResponse.json({ error: "Missing required fields: name, metric, operator, threshold." }, { status: 400 });
  }

  const rule = await prisma.alertRule.create({
    data: {
      orgId: org.id,
      name,
      metric,
      operator,
      threshold: parseFloat(threshold),
      severity: severity || "warning",
      cooldownMinutes: parseInt(cooldownMinutes) || 60,
    },
  });

  return NextResponse.json({ rule }, { status: 201 });
}
