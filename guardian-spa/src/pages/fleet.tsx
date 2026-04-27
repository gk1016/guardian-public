import { useSession } from "@/lib/auth";
import { FleetDashboard } from "@/components/fleet-dashboard";
import { ReadinessGauge } from "@/components/readiness-gauge";

export function FleetPage() {
  const session = useSession();
  const isAdmin = session.role === "commander" || session.role === "director";

  return (
    <div className="space-y-4">
      <ReadinessGauge />
      <FleetDashboard isAdmin={isAdmin} />
    </div>
  );
}
