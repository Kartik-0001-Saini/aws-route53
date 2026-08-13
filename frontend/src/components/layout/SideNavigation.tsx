"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * The Route 53 left-hand navigation.
 *
 * Structure and ordering follow the real console: the service name as a
 * heading, then Dashboard, then the DNS management group, then Traffic flow,
 * Health checks, Resolver and Profiles. Sections the assignment scopes out are
 * present and navigable — they lead to a "Coming soon" page rather than being
 * hidden, because a missing nav item would be a visible departure from the
 * console.
 */

interface NavLink {
  label: string;
  href: string;
}

interface NavSection {
  /** Section heading. Absent for the first, ungrouped group of links. */
  title?: string;
  links: NavLink[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    links: [{ label: "Dashboard", href: "/dashboard" }],
  },
  {
    title: "DNS management",
    links: [{ label: "Hosted zones", href: "/hosted-zones" }],
  },
  {
    title: "Traffic management",
    links: [
      { label: "Traffic policies", href: "/traffic-policies" },
      { label: "Policy records", href: "/policy-records" },
    ],
  },
  {
    title: "Availability monitoring",
    links: [{ label: "Health checks", href: "/health-checks" }],
  },
  {
    title: "Resolver",
    links: [
      { label: "VPCs", href: "/resolver/vpcs" },
      { label: "Inbound endpoints", href: "/resolver/inbound-endpoints" },
      { label: "Outbound endpoints", href: "/resolver/outbound-endpoints" },
      { label: "Rules", href: "/resolver/rules" },
    ],
  },
  {
    title: "Profiles",
    links: [{ label: "Profiles", href: "/profiles" }],
  },
];

interface SideNavigationProps {
  /** Drawer state below lg. Above lg the nav is always visible. */
  open: boolean;
  onClose: () => void;
}

export function SideNavigation({ open, onClose }: SideNavigationProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Scrim, drawer mode only. */}
      {open && (
        <div
          className="fixed inset-0 top-10 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <nav
        aria-label="Route 53 navigation"
        className={cn(
          "fixed left-0 top-10 z-30 h-[calc(100vh-2.5rem)] w-64 shrink-0",
          "overflow-y-auto border-r border-divider bg-side-nav",
          "transition-transform duration-200 lg:sticky lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="px-6 py-4">
          <Link
            href="/dashboard"
            className="text-base font-bold text-heading hover:text-link"
          >
            Route 53
          </Link>
        </div>

        <div className="pb-8">
          {NAV_SECTIONS.map((section, index) => (
            <div key={section.title ?? `section-${index}`}>
              {section.title && (
                <h3 className="px-6 pb-1 pt-4 text-sm font-bold text-heading">
                  {section.title}
                </h3>
              )}

              <ul>
                {section.links.map((link) => {
                  // `startsWith` so a nested route (a zone detail page) keeps
                  // its parent nav item highlighted, as the console does.
                  const isActive =
                    pathname === link.href ||
                    pathname.startsWith(`${link.href}/`);

                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={onClose}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "block border-l-2 py-1.5 pl-[22px] pr-6 text-sm",
                          "transition-colors",
                          isActive
                            ? "border-primary bg-selected font-bold text-link"
                            : "border-transparent text-body hover:bg-hover",
                        )}
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="mt-6 border-t border-subtle px-6 pt-4">
            <a
              href="https://docs.aws.amazon.com/route53/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-link hover:underline"
            >
              Documentation
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </nav>
    </>
  );
}
