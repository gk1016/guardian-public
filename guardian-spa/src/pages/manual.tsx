import { useSession } from "@/lib/auth";
import { canManageOperations } from "@/lib/roles";
import { ManualCenter } from "@/components/manual-center";

export function ManualPage() {
  const session = useSession();
  const canAuthor = canManageOperations(session.role);

  return <ManualCenter canAuthor={canAuthor} />;
}
