import { FederationPanel } from "@/components/federation-panel";
import { FederatedIntelFeed } from "@/components/federated-intel-feed";

export function FederationPage() {
  return (
    <div className="flex flex-col gap-6">
      <FederationPanel />
      <FederatedIntelFeed />
    </div>
  );
}
