import type { Metadata } from "next";

import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <ComingSoon
      title="Route 53 dashboard"
      description="An overview of your DNS resources and their health."
      capabilities={[
        "Resource counts for hosted zones, health checks and traffic policies",
        "Domain registration and transfer status",
        "Recent alarms raised by health checks",
        "Service health and quota usage for the account",
      ]}
    />
  );
}
