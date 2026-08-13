import type { Metadata } from "next";

import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Traffic policies" };

export default function TrafficPoliciesPage() {
  return (
    <ComingSoon
      title="Traffic policies"
      description="Versioned routing configurations that combine several routing policies into one decision tree."
      capabilities={[
        "Visual editor for chaining weighted, latency, failover and geolocation rules",
        "Versioning, so a policy can be revised without disturbing live traffic",
        "Applying one policy to records across multiple hosted zones",
      ]}
    />
  );
}
