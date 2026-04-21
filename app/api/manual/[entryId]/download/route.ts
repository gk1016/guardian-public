import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { entryId } = await params;
  const org = await getOrgForUser(session.userId);
  if (!org) {
    return NextResponse.json({ error: "No organization found." }, { status: 400 });
  }

  const entry = await prisma.manualEntry.findFirst({
    where: { id: entryId, orgId: org.id, entryType: "file" },
    select: {
      fileName: true,
      fileMimeType: true,
      fileData: true,
    },
  });

  if (!entry || !entry.fileData) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  return new NextResponse(entry.fileData, {
    headers: {
      "Content-Type": entry.fileMimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${entry.fileName ?? "download"}"`,
      "Content-Length": String(entry.fileData.length),
    },
  });
}
