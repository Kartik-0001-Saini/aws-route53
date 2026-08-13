import type { Metadata } from "next";

import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Inbound endpoints" };

const BREADCRUMBS = [{ label: "Resolver" }, { label: "Inbound endpoints" }];

export default function InboundEndpointsPage() {
  return (
    <ComingSoon
      title="Inbound endpoints"
      breadcrumbs={BREADCRUMBS}
      description="Entry points that let DNS queries from your on-premises network resolve names inside a VPC."
      capabilities={[
        "IP addresses in two or more availability zones, for resilience",
        "Security groups controlling which networks may query the endpoint",
        "Resolving private hosted zone names from outside AWS",
      ]}
    />
  );
}
