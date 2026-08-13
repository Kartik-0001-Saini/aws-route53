import type { Metadata } from "next";

import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Resolver rules" };

const BREADCRUMBS = [{ label: "Resolver" }, { label: "Rules" }];

export default function ResolverRulesPage() {
  return (
    <ComingSoon
      title="Rules"
      breadcrumbs={BREADCRUMBS}
      description="Rules deciding how Route 53 Resolver answers queries for a given domain."
      capabilities={[
        "Forwarding rules that send a domain's queries to an outbound endpoint",
        "System rules that override forwarding for specific subdomains",
        "Sharing rules across accounts with AWS Resource Access Manager",
      ]}
    />
  );
}
