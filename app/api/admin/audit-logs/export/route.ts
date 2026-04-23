import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { canManageAdministration } from "@/lib/roles";
import { auditLog } from "@/lib/audit";

/**
 * GET /api/admin/audit-logs/export?from=ISO&to=ISO&format=csv|json
 * Bulk export of audit logs for compliance. Max 10,000 records per request.
 */
export async function GET(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageAdministration(session.role)) {
    return NextResponse.json({ error: "Admin authority required." }, { status: 403 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const format = url.searchParams.get("format") ?? "json";

  const where: Record<string, unknown> = { orgId: org.id };
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.gte = new Date(from);
    if (to) createdAt.lte = new Date(to);
    where.createdAt = createdAt;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10000,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      metadata: true,
      createdAt: true,
      user: {
        select: {
          handle: true,
          displayName: true,
          email: true,
        },
      },
    },
  });

  auditLog({
    userId: session.userId,
    orgId: org.id,
    action: "export_audit_logs",
    targetType: "audit_log",
    metadata: { from, to, format, count: logs.length },
  });

  if (format === "csv") {
    const header = "id,timestamp,actor_handle,actor_email,action,target_type,target_id,metadata";
    const rows = logs.map((l) => {
      const meta = l.metadata ? JSON.stringify(l.metadata).replace(/"/g, '""') : "";
      return [
        l.id,
        l.createdAt.toISOString(),
        l.user.handle,
        l.user.email,
        l.action,
        l.targetType,
        l.targetId ?? "",
        `"${meta}"`,
      ].join(",");
    });

    const csv = [header, ...rows].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="guardian-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  // JSON format
  const items = logs.map((l) => ({
    id: l.id,
    timestamp: l.createdAt.toISOString(),
    actor: {
      handle: l.user.handle,
      displayName: l.user.displayName,
      email: l.user.email,
    },
    action: l.action,
    targetType: l.targetType,
    targetId: l.targetId,
    metadata: l.metadata,
  }));

  return NextResponse.json({
    ok: true,
    exported: items.length,
    from: from ?? null,
    to: to ?? null,
    items,
  });
}
