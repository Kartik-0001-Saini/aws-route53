import { redirect } from "next/navigation";

/**
 * The console has no page of its own at `/`.
 *
 * Route 53's landing screen is the dashboard, so the root redirects there; the
 * console layout then bounces an unauthenticated visitor on to `/login`.
 */
export default function RootPage() {
  redirect("/dashboard");
}
