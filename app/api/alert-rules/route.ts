import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageAdministration } from "@/lib/roles";
import { auditLog } from "@/lib/audit";

const createRuleSchema = z.object({
  name: z.string().trim().min(2).max(100),
  metric: z.string().trim().min(2).max(60),
  operator: z.string().trim().min(1).max(10),
  threshold: z.number(),
  severity: z.enum(["info", "warning", "critical"]).default("warning"),
  cooldownMinutes: z.number().int().min(1).max(1440).default(60),
});

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageAdministration(session.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const payload = createRuleSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid alert rule payload." }, { status: 400 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const rule = await prisma.alertRule.create({
    data: {
      orgId: org.id,
      name: payload.data.name,
      metric: payload.data.metric,
      operator: payload.data.operator,
      threshold: payload.data.threshold,
      severity: payload.data.severity,
      cooldownMinutes: payload.data.cooldownMinutes,
    },
  });

  auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "create",
    targetType: "alert_rule",
    targetId: rule.id,
    metadata: { name: payload.data.name, metric: payload.data.metric },
  });

  return NextResponse.json({ ok: true, rule });
}
