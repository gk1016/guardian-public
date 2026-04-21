import { BookOpen } from "lucide-react";
import { ManualCenter } from "@/components/manual-center";
import { OpsShell } from "@/components/ops-shell";
import { requireSession } from "@/lib/auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { canManageOperations } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ManualPage() {
  const session = await requireSession("/manual");
  const org = await getOrgForUser(session.userId);
  const orgName = org?.name ?? "Guardian";
  const canAuthor = canManageOperations(session.role);

  let initialItems: {
    id: string;
    title: string;
    category: string;
    entryType: string;
    body: string;
    bodyPreview: string;
    fileName: string | null;
    fileSize: number | null;
    fileMimeType: string | null;
    createdAt: string;
    updatedAt: string;
    authorDisplay: string;
  }[] = [];

  if (org) {
    const entries = await prisma.manualEntry.findMany({
      where: { orgId: org.id },
      orderBy: [{ category: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        category: true,
        entryType: true,
        body: true,
        fileName: true,
        fileSize: true,
        fileMimeType: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: { handle: true, displayName: true },
        },
      },
    });

    initialItems = entries.map((e) => ({
      id: e.id,
      title: e.title,
      category: e.category,
      entryType: e.entryType,
      body: e.entryType === "article" ? e.body : "",
      bodyPreview: e.body.slice(0, 200),
      fileName: e.fileName,
      fileSize: e.fileSize,
      fileMimeType: e.fileMimeType,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      authorDisplay: e.author.displayName ?? e.author.handle,
    }));
  }

  return (
    <OpsShell
      currentPath="/manual"
      section="Reference"
      title="Manual"
      orgName={orgName}
      session={session}
    >
      <ManualCenter initialItems={initialItems} canAuthor={canAuthor} />
    </OpsShell>
  );
}
