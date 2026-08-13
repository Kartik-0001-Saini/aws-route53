"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils/cn";

/**
 * Sign-in, modelled on the AWS console's own: a narrow centred card on a dark
 * background, service name above it.
 *
 * Two paths are offered side by side. Google is the real one; the demo button
 * exists so the hosted link can be opened by anyone — a blocked popup, a
 * Workspace policy that forbids third-party OAuth consent, or simply not
 * wanting to hand over a Google account should not be the difference between
 * seeing the app and seeing nothing.
 */
export default function LoginPage() {
  const {
    status,
    googleEnabled,
    signingIn,
    error,
    signInWithGoogleAccount,
    signInAsDemo,
  } = useAuth();
  const router = useRouter();

  // A visitor with a live session should never sit on the login screen — this
  // fires when they navigate here directly with a persisted token.
  useEffect(() => {
    if (status === "authenticated") router.replace("/hosted-zones");
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0f1b2a]">
        <Spinner size="lg" className="text-white" label="Checking session" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#0f1b2a] px-4 py-16">
      <div className="mb-8 flex flex-col items-center gap-3">
        <span className="flex items-baseline gap-1 text-white">
          <span className="text-2xl font-bold leading-none tracking-tight">
            aws
          </span>
          <span className="h-1.5 w-5 rounded-b-full border-b-2 border-[#ff9900]" />
        </span>
        <h1 className="text-lg font-bold text-white">
          Route 53 Management Console
        </h1>
      </div>

      <div
        className={cn(
          "w-full max-w-[400px] rounded-[var(--radius-container)]",
          "bg-container p-6 shadow-[var(--shadow-modal)]",
        )}
      >
        <h2 className="text-base font-bold text-heading">Sign in</h2>
        <p className="mt-1 text-sm text-secondary">
          Choose how you would like to access the console.
        </p>

        {error && (
          <div
            role="alert"
            className={cn(
              "mt-4 flex items-start gap-2 rounded-[var(--radius-input)]",
              "border border-error bg-error-bg px-3 py-2.5",
            )}
          >
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-error"
              aria-hidden="true"
            />
            <p className="text-sm text-body">{error}</p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {googleEnabled && (
            <>
              <Button
                variant="normal"
                fullWidth
                loading={signingIn === "google"}
                disabled={signingIn !== null}
                onClick={() => void signInWithGoogleAccount()}
                iconLeft={signingIn === "google" ? undefined : <GoogleMark />}
              >
                Continue with Google
              </Button>

              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-divider" />
                <span className="text-xs text-secondary">or</span>
                <span className="h-px flex-1 bg-divider" />
              </div>
            </>
          )}

          <Button
            variant="primary"
            fullWidth
            loading={signingIn === "demo"}
            disabled={signingIn !== null}
            onClick={() => void signInAsDemo()}
          >
            Continue as demo user
          </Button>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-secondary">
          {googleEnabled
            ? "Signing in with Google creates your own account, pre-populated with sample hosted zones. The demo account is shared and needs no credentials."
            : "Google sign-in is not configured on this deployment. The demo account is shared, needs no credentials, and comes with sample hosted zones."}
        </p>
      </div>

      <p className="mt-8 max-w-[400px] text-center text-xs text-white/50">
        This is a clone built for an assignment. It is not affiliated with
        Amazon Web Services, and it performs no DNS resolution.
      </p>
    </main>
  );
}

/** Google's four-colour "G". Inlined so the button needs no network request. */
function GoogleMark() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
