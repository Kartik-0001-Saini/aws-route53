"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * The console's pagination control: previous, a windowed run of page numbers,
 * next — right-aligned under the table.
 */

/** How many numbered buttons to show before collapsing to an ellipsis. */
const MAX_VISIBLE_PAGES = 7;

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

/**
 * Page numbers to render, with `null` marking a gap.
 *
 * Below the cap, every page is listed. Above it, the first and last pages are
 * pinned and a window follows the current one, so the control keeps a fixed
 * width no matter how many pages exist.
 */
function buildPageList(page: number, totalPages: number): (number | null)[] {
  if (totalPages <= MAX_VISIBLE_PAGES) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: (number | null)[] = [1];

  const windowStart = Math.max(2, page - 1);
  const windowEnd = Math.min(totalPages - 1, page + 1);

  if (windowStart > 2) pages.push(null);
  for (let current = windowStart; current <= windowEnd; current += 1) {
    pages.push(current);
  }
  if (windowEnd < totalPages - 1) pages.push(null);

  pages.push(totalPages);
  return pages;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
}: PaginationProps) {
  // One page is not a choice — the control would be decoration.
  if (totalPages <= 1) return null;

  const pages = buildPageList(page, totalPages);

  const buttonClasses = (active: boolean) =>
    cn(
      "grid h-7 min-w-7 place-items-center rounded px-1.5 text-sm",
      "transition-colors disabled:cursor-not-allowed disabled:text-disabled",
      active
        ? "font-bold text-body underline underline-offset-4"
        : "text-link hover:bg-hover",
    );

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-end gap-0.5"
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={disabled || page <= 1}
        aria-label="Previous page"
        className={buttonClasses(false)}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      {pages.map((entry, index) =>
        entry === null ? (
          <span
            key={`gap-${index}`}
            className="px-1 text-sm text-secondary"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onPageChange(entry)}
            disabled={disabled}
            aria-label={`Page ${entry}`}
            aria-current={entry === page ? "page" : undefined}
            className={buttonClasses(entry === page)}
          >
            {entry}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={disabled || page >= totalPages}
        aria-label="Next page"
        className={buttonClasses(false)}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
