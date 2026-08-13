"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { SideNavigation } from "@/components/layout/SideNavigation";
import { TopNavigation } from "@/components/layout/TopNavigation";
import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "@/lib/auth/auth-context";

/**
 * The authenticated frame: top bar, side navigation, content column.
 *
 * Also the route guard. There is no Next.js proxy doing this, and deliberately
 * so — the session lives in the browser (Firebase's IndexedDB, or the demo
 * token in localStorage), and a server-side check has no access to either. The
 * real protection is the API: every endpoint verifies the Bearer token, so an
 * unauthenticated visitor who forced their way past this component would see a
 * shell with no data in it.
 */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const [sideNavOpen, setSideNavOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // One spinner covers both "restoring a session" and "redirecting away",
  // because rendering the console frame for either would show a flash of empty
  // tables the user then loses.
  if (status !== "authenticated") {
    return (
      <div className="grid min-h-screen place-items-center bg-page">
        <div className="flex flex-col items-center gap-3 text-secondary">
          <Spinner size="lg" className="text-primary" label="Loading console" />
          <p className="text-sm">Loading console…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      <TopNavigation onToggleSideNav={() => setSideNavOpen((open) => !open)} />

      <div className="flex">
        <SideNavigation
          open={sideNavOpen}
          onClose={() => setSideNavOpen(false)}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
