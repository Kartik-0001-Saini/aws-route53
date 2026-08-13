import type { Metadata } from "next";

import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Profiles" };

export default function ProfilesPage() {
  return (
    <ComingSoon
      title="Profiles"
      description="Reusable bundles of DNS settings that can be shared across VPCs and accounts."
      capabilities={[
        "Grouping private hosted zones, Resolver rules and DNSSEC configuration",
        "Sharing a profile across accounts with AWS Resource Access Manager",
        "Associating a profile with many VPCs at once, instead of one by one",
      ]}
    />
  );
}
