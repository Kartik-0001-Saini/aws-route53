import { Construction } from "lucide-react";

import { PageLayout } from "@/components/layout/PageLayout";
import type { Crumb } from "@/components/layout/Breadcrumbs";

/**
 * Placeholder for the console sections the assignment scopes out.
 *
 * These pages exist rather than being omitted so the navigation matches the
 * real console — a Route 53 clone with no Health checks entry reads as
 * incomplete, whereas one that navigates to a stated placeholder reads as
 * scoped.
 */
export interface ComingSoonProps {
  title: string;
  description: string;
  breadcrumbs?: Crumb[];
  /** What the real console offers here, so the placeholder still informs. */
  capabilities?: string[];
}

export function ComingSoon({
  title,
  description,
  breadcrumbs,
  capabilities,
}: ComingSoonProps) {
  return (
    <PageLayout title={title} description={description} breadcrumbs={breadcrumbs}>
      <div className="rounded-[var(--radius-container)] border border-divider bg-container shadow-[var(--shadow-container)]">
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-selected">
            <Construction className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>

          <h2 className="text-base font-bold text-heading">Coming soon</h2>
          <p className="mt-2 max-w-md text-sm text-secondary">
            This section is out of scope for this build. Hosted zones and DNS
            records are fully implemented.
          </p>

          {capabilities && capabilities.length > 0 && (
            <div className="mt-6 w-full max-w-md text-left">
              <h3 className="mb-2 text-sm font-bold text-heading">
                In the real console, this section handles:
              </h3>
              <ul className="flex flex-col gap-1.5">
                {capabilities.map((capability) => (
                  <li
                    key={capability}
                    className="flex gap-2 text-sm text-secondary"
                  >
                    <span aria-hidden="true">•</span>
                    <span>{capability}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
