import type { Metadata } from "next";

import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Health checks" };

export default function HealthChecksPage() {
  return (
    <ComingSoon
      title="Health checks"
      description="Monitors that watch an endpoint and let Route 53 route traffic away from it when it fails."
      capabilities={[
        "Endpoint checks by IP address or domain name, over HTTP, HTTPS or TCP",
        "Calculated checks that combine the status of several other checks",
        "CloudWatch alarm checks, and alarms raised on failure",
        "Associating a health check with a failover or weighted record",
      ]}
    />
  );
}
