"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, Moon, Search, Sun } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-context";
import { useTheme } from "@/lib/theme/theme-context";
import { cn } from "@/lib/utils/cn";

/**
 * The dark navy bar across the top of every AWS console page.
 *
 * Left to right, as in the real console: the AWS wordmark, a search box, then
 * the right-hand cluster of region and account menus. The bar keeps its dark
 * palette in both themes — in the real console it does not invert either.
 */

interface TopNavigationProps {
  onToggleSideNav: () => void;
}

export function TopNavigation({ onToggleSideNav }: TopNavigationProps) {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Close the account menu on an outside click or Escape — the two ways a user
  // expects to dismiss a menu they opened by accident.
  useEffect(() => {
    if (!accountMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  const accountLabel =
    user?.display_name || user?.email?.split("@")[0] || "Account";

  return (
    <header className="sticky top-0 z-40 h-10 bg-top-nav text-white">
      <div className="flex h-full items-center gap-1 pr-2">
        {/* Side-nav toggle — visible below lg, where the nav is a drawer. */}
        <button
          type="button"
          onClick={onToggleSideNav}
          aria-label="Toggle navigation"
          className="grid h-10 w-10 place-items-center hover:bg-white/10 lg:hidden"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>

        <Link
          href="/hosted-zones"
          className="flex h-10 items-center gap-2 px-3 hover:bg-white/10"
        >
          <AwsWordmark />
        </Link>

        <div className="hidden min-w-0 flex-1 items-center px-2 md:flex">
          <div className="relative w-full max-w-md">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/60"
              aria-hidden="true"
            />
            <input
              type="search"
              // Non-functional by design: the assignment scopes search to
              // hosted zones and records, both of which have their own search
              // box. This is here because the bar looks wrong without it.
              disabled
              placeholder="Search services (mocked)"
              aria-label="Search AWS services — not available in this clone"
              className={cn(
                "h-6 w-full rounded-[var(--radius-input)] bg-white/10 pl-8 pr-3",
                "text-xs text-white placeholder:text-white/50",
                "disabled:cursor-not-allowed",
              )}
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="grid h-10 w-10 place-items-center hover:bg-white/10"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <span className="hidden h-10 items-center px-3 text-xs sm:flex">
            Asia Pacific (Mumbai)
          </span>

          <div ref={accountMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setAccountMenuOpen((open) => !open)}
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              className="flex h-10 items-center gap-1.5 px-3 text-xs hover:bg-white/10"
            >
              <span className="max-w-40 truncate">{accountLabel}</span>
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </button>

            {accountMenuOpen && (
              <div
                role="menu"
                className={cn(
                  "absolute right-0 top-10 w-64 border border-divider",
                  "bg-container text-body shadow-[var(--shadow-dropdown)]",
                )}
              >
                <div className="border-b border-subtle px-4 py-3">
                  <p className="truncate text-sm font-bold text-heading">
                    {user?.display_name ?? "Demo User"}
                  </p>
                  <p className="truncate text-xs text-secondary">{user?.email}</p>
                  <p className="mt-2 font-mono text-xs text-secondary">
                    Account: {user?.aws_account_id}
                  </p>
                  {user?.provider === "demo" && (
                    <p className="mt-2 text-xs text-secondary">
                      Signed in to the shared demo account.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    void signOut();
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-link hover:bg-hover"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * The AWS wordmark, drawn rather than imported.
 *
 * Amazon's actual logo is a trademarked asset and is not redistributable, so
 * this is a plain type treatment with the "smile" underline that reads
 * correctly in the header without copying the mark itself.
 */
function AwsWordmark() {
  return (
    <span className="flex items-baseline gap-1" aria-label="AWS console home">
      <span className="text-[15px] font-bold leading-none tracking-tight">
        aws
      </span>
      <span className="h-1 w-3 rounded-b-full border-b-2 border-[#ff9900]" />
    </span>
  );
}
