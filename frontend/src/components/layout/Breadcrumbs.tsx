import Link from "next/link";

export interface Crumb {
  label: string;
  /** Omitted on the final crumb, which is the current page. */
  href?: string;
}

/**
 * The console's breadcrumb trail, sitting above the page heading.
 *
 * Rendered from an explicit list passed by each page rather than derived from
 * the URL: a zone detail route is `/hosted-zones/Z0477…`, and the crumb has to
 * read "example.com", which the path alone cannot supply.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumbs">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm">
        {items.map((crumb, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && (
                <span className="text-secondary" aria-hidden="true">
                  /
                </span>
              )}

              {crumb.href && !isLast ? (
                <Link href={crumb.href} className="text-link hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className="text-body"
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
