import type { ReactNode } from "react";

import { Breadcrumbs, type Crumb } from "@/components/layout/Breadcrumbs";
import { Flashbar } from "@/components/ui/Flashbar";
import { cn } from "@/lib/utils/cn";

/**
 * The content column of a console page.
 *
 * Fixes the vertical rhythm every screen shares — breadcrumbs, flash messages,
 * heading with its optional description and action cluster, then content — so
 * no page has to reinvent the spacing and none of them drift apart.
 */

export interface PageLayoutProps {
  breadcrumbs?: Crumb[];
  title: string;
  /** Sits beside the title, as Route 53 shows "(5)" next to Hosted zones. */
  counter?: string;
  description?: string;
  /** Buttons rendered to the right of the heading. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageLayout({
  breadcrumbs,
  title,
  counter,
  description,
  actions,
  children,
  className,
}: PageLayoutProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[1440px] px-6 py-4", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="mb-4">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      )}

      <div className="mb-4 empty:mb-0">
        <Flashbar />
      </div>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight text-heading">
            {title}
            {counter && (
              <span className="ml-2 font-normal text-secondary">{counter}</span>
            )}
          </h1>
          {description && (
            <p className="mt-1 max-w-3xl text-sm text-secondary">{description}</p>
          )}
        </div>

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {children}
    </div>
  );
}
