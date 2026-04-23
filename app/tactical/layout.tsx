import type { ReactNode } from "react";

// Tactical board uses its own minimal layout — no sidebar, no shell
export default function TacticalLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
