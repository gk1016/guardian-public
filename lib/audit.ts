import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { log } from "@/lib/logger";

/**
 * Fire-and-forget audit log writer.
 * Never throws — audit failures must not break the request.
 */
export async function auditLog(params: {
  userId: string;
  orgId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        orgId: params.orgId ?? null,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId ?? null,
        metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (e) {
    log.error("Failed to write audit log", {
      component: "audit",
      action: params.action,
      targetType: params.targetType,
      err: e instanceof Error ? e.message : String(e),
    });
  }
}
