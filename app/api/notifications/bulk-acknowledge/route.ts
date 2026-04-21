import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";

const bulkAckSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
});

export async function PATCH(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = bulkAckSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload. Provide ids array." }, { status: 400 });
  }

  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const result = await prisma.notification.updateMany({
    where: {
      id: { in: payload.data.ids },
      orgId: org.id,
      status: "unread",
    },
    data: {
      status: "acknowledged",
      acknowledgedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, acknowledged: result.count });
}
