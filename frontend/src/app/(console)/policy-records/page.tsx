import type { Metadata } from "next";

import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Policy records" };

export default function PolicyRecordsPage() {
  return (
    <ComingSoon
      title="Policy records"
      description="DNS records created by applying a traffic policy to a hosted zone."
      capabilities={[
        "Creating a policy record from a traffic policy version",
        "Rolling a live policy record forward or back between versions",
        "Tracking which hosted zones a policy is currently applied to",
      ]}
    />
  );
}
