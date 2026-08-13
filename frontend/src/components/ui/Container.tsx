import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The console's content card: a rounded, bordered surface with an optional
 * header row carrying a title, a counter, a description and actions.
 *
 * Every table and detail panel sits in one of these, which is what gives the
 * console its consistent horizontal rhythm.
 */
export interface ContainerProps {
  title?: ReactNode;
  /** Rendered next to the title in grey, as Route 53 shows "(12)". */
  counter?: string;
  description?: string;
  /** Buttons on the right of the header row. */
  actions?: ReactNode;
  /** Filters and search, rendered on their own row below the header. */
  filters?: ReactNode;
  children: ReactNode;
  /** Drop the body padding — tables manage their own. */
  disableContentPadding?: boolean;
  className?: string;
}

export function Container({
  title,
  counter,
  description,
  actions,
  filters,
  children,
  disableContentPadding = false,
  className,
}: ContainerProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[var(--radius-container)] border border-divider",
        "bg-container shadow-[var(--shadow-container)]",
        className,
      )}
    >
      {hasHeader && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-base font-bold leading-tight text-heading">
                {title}
                {counter && (
                  <span className="ml-2 font-normal text-secondary">
                    {counter}
                  </span>
                )}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-secondary">{description}</p>
            )}
          </div>

          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      )}

      {filters && (
        <div className="border-t border-subtle px-4 py-3 first:border-t-0">
          {filters}
        </div>
      )}

      <div className={cn(!disableContentPadding && "px-4 py-3")}>{children}</div>
    </section>
  );
}
