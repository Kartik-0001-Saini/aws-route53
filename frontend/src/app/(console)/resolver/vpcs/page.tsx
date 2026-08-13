import type { Metadata } from "next";

import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Resolver VPCs" };

const BREADCRUMBS = [{ label: "Resolver" }, { label: "VPCs" }];

export default function ResolverVpcsPage() {
  return (
    <ComingSoon
      title="VPCs"
      breadcrumbs={BREADCRUMBS}
      description="Virtual private clouds and the DNS configuration Route 53 Resolver applies to each."
      capabilities={[
        "DNS query logging configuration per VPC",
        "DNSSEC validation and DNS firewall rule group associations",
        "Which Resolver rules and private hosted zones a VPC resolves against",
      ]}
    />
  );
}
