"use client";

import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { ApiError } from "@/lib/api/client";
import { AuthProvider } from "@/lib/auth/auth-context";
import {
  NotificationProvider,
  useNotifications,
} from "@/lib/notifications/notification-context";
import { ThemeProvider } from "@/lib/theme/theme-context";

/**
 * Client-side providers, in dependency order.
 *
 * Theme is outermost because it touches nothing else. Notifications sit above
 * Auth so a sign-in failure can raise a flash message. React Query is
 * innermost, since every query it runs needs a token from Auth.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

/**
 * React Query, wired to report failed reads as flash messages.
 *
 * The reporting lives here rather than in each page because a `useEffect`
 * watching `isError` and calling `notify` is a cascading render — React's own
 * lint rules flag it — and every list page would need its own copy. One
 * `QueryCache` handler covers all of them and cannot be forgotten on a new
 * screen.
 *
 * Split into its own component because it needs `useNotifications`, which is
 * only available below `NotificationProvider`.
 */
function QueryProvider({ children }: { children: ReactNode }) {
  const { notifyError } = useNotifications();

  // Created in state, not at module scope: a module-level client would be
  // shared across requests on the server and leak one user's cached data into
  // another's response.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            // 401s are the auth layer's business — it signs the user out and
            // redirects. A flash message on top of that would just be noise on
            // the login screen.
            if (error instanceof ApiError && error.isUnauthenticated) return;

            notifyError(
              error instanceof ApiError
                ? error.message
                : "Could not load data from the server.",
              "Error",
            );
          },
        }),
        defaultOptions: {
          queries: {
            // The console is a data-management tool — a stale zone list after
            // someone else's change is worse than a refetch.
            staleTime: 10_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Retrying a 4xx just repeats the same rejection. Only genuine
              // transport failures and 5xx are worth a second attempt — which
              // also covers a backend still waking from idle.
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
                return false;
              }
              return failureCount < 2;
            },
          },
          mutations: {
            // Mutations are user-initiated and report their own outcome; a
            // silent retry could duplicate a create.
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
