import type { ReactNode } from "react";

import { ConsoleShell } from "@/components/layout/ConsoleShell";

/**
 * Layout for every authenticated console page.
 *
 * A route group `(console)` rather than a path segment, so the URLs stay
 * `/hosted-zones` and `/dashboard` — matching the real console — while still
 * sharing one frame and one auth guard.
 */
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
