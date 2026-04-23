import { requireSession } from "@/lib/auth";
import { TacticalBoard } from "@/components/tactical-board";

export const dynamic = "force-dynamic";

export default async function TacticalPage() {
  const session = await requireSession("/tactical");

  return (
    <div className="h-screen w-screen bg-[#0a0e14] text-[var(--color-text-primary)] overflow-hidden">
      <TacticalBoard session={{ handle: session.handle, role: session.role }} />
    </div>
  );
}
