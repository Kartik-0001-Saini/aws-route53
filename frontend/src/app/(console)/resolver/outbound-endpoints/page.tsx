import type { Metadata } from "next";

import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Outbound endpoints" };

const BREADCRUMBS = [{ label: "Resolver" }, { label: "Outbound endpoints" }];

export default function OutboundEndpointsPage() {
  return (
    <ComingSoon
      title="Outbound endpoints"
      breadcrumbs={BREADCRUMBS}
      description="Exit points that forward DNS queries from a VPC to resolvers on your own network."
      capabilities={[
        "Forwarding queries for specified domains to on-premises DNS servers",
        "IP addresses in two or more availability zones, for resilience",
        "Pairing with Resolver rules to decide which domains are forwarded",
      ]}
    />
  );
}
