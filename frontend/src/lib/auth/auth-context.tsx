"use client";

/**
 * Session state for the whole console.
 *
 * Two sign-in paths converge on one shape. Whichever was used, the rest of the
 * app sees a `UserProfile` and an authenticated status — nothing outside this
 * file branches on "was this the demo user".
 *
 *   Google  →  Firebase holds the session; the SDK refreshes the ID token.
 *   Demo    →  a signed token from our backend, kept in localStorage.
 *
 * The token provider registered here is what `lib/api/client.ts` calls before
 * every request, so a token that expires mid-session is refreshed rather than
 * producing a surprise 401.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ApiError, setTokenProvider } from "@/lib/api/client";
import { authApi } from "@/lib/api/endpoints";
import {
  describeFirebaseError,
  getFirebaseAuth,
  isFirebaseConfigured,
  signInWithGoogle,
  signOutFromFirebase,
} from "@/lib/firebase/client";
import type { UserProfile } from "@/types/api";

const DEMO_TOKEN_KEY = "route53-clone.demo-token";
const DEMO_EXPIRY_KEY = "route53-clone.demo-token-expires-at";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: UserProfile | null;
  /**
   * Whether the Google button should be rendered at all.
   *
   * Requires *both* halves: the client SDK needs its config to open the popup,
   * and the backend needs a service account to verify the resulting token.
   * With only one, the user would sign in with Google successfully and then be
   * rejected by the API — a worse failure than never offering the button.
   */
  googleEnabled: boolean;
  /** In-flight sign-in, for button pending states. */
  signingIn: "google" | "demo" | null;
  error: string | null;
  signInWithGoogleAccount: () => Promise<void>;
  signInAsDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/* ==========================================================================
   Demo token storage
   ========================================================================== */

function readDemoToken(): string | null {
  if (typeof window === "undefined") return null;

  const token = window.localStorage.getItem(DEMO_TOKEN_KEY);
  const expiresAt = window.localStorage.getItem(DEMO_EXPIRY_KEY);
  if (!token || !expiresAt) return null;

  // Discard a token that is already expired rather than sending it and taking
  // a 401 — the user would see a flash of the console before being ejected.
  if (Date.parse(expiresAt) <= Date.now()) {
    clearDemoToken();
    return null;
  }

  return token;
}

function storeDemoToken(token: string, expiresAt: string): void {
  window.localStorage.setItem(DEMO_TOKEN_KEY, token);
  window.localStorage.setItem(DEMO_EXPIRY_KEY, expiresAt);
}

function clearDemoToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEMO_TOKEN_KEY);
  window.localStorage.removeItem(DEMO_EXPIRY_KEY);
}

/* ==========================================================================
   Provider
   ========================================================================== */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [signingIn, setSigningIn] = useState<"google" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Whether the *server* can verify a Google token. Answered by /auth/config. */
  const [serverGoogleEnabled, setServerGoogleEnabled] = useState(false);

  /**
   * Mirrors of the token sources, read synchronously by the token provider.
   *
   * Refs rather than state: the provider is called from outside React's render
   * cycle, and a stale closure over state would hand the API an old token.
   */
  const demoTokenRef = useRef<string | null>(null);
  const hasFirebaseUserRef = useRef(false);

  // Register the token provider once, before any request can be made.
  useEffect(() => {
    setTokenProvider(async () => {
      if (demoTokenRef.current) return demoTokenRef.current;

      if (isFirebaseConfigured && hasFirebaseUserRef.current) {
        const auth = await getFirebaseAuth();
        // getIdToken() returns the cached token and silently refreshes it when
        // it is close to expiry — this is what keeps a long session alive.
        return (await auth.currentUser?.getIdToken()) ?? null;
      }

      return null;
    });
  }, []);

  const applySignedOutState = useCallback(() => {
    demoTokenRef.current = null;
    hasFirebaseUserRef.current = false;
    clearDemoToken();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  /** Exchange whatever token we hold for the user profile. */
  const loadSession = useCallback(async (): Promise<boolean> => {
    try {
      const { user: profile } = await authApi.getSession();
      setUser(profile);
      setStatus("authenticated");
      return true;
    } catch (caught) {
      // A dead token is the normal case here — a returning visitor whose demo
      // session lapsed. Anything else (backend down) also lands on the login
      // screen, but keeps its message so the cause is visible.
      if (caught instanceof ApiError && !caught.isUnauthenticated) {
        setError(caught.message);
      }
      applySignedOutState();
      return false;
    }
  }, [applySignedOutState]);

  // Ask the server which sign-in methods it can actually honour.
  useEffect(() => {
    let cancelled = false;

    authApi
      .getConfig()
      .then((config) => {
        if (!cancelled) setServerGoogleEnabled(config.google_enabled);
      })
      .catch(() => {
        // Backend unreachable: leave Google hidden. The demo button will
        // surface the real problem when it is pressed.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Boot: restore a persisted session, if there is one.
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const demoToken = readDemoToken();
      if (demoToken) {
        demoTokenRef.current = demoToken;
        if (!cancelled) await loadSession();
        return;
      }

      if (!isFirebaseConfigured) {
        if (!cancelled) setStatus("unauthenticated");
        return;
      }

      // Firebase restores its session asynchronously from IndexedDB. Waiting
      // for the first callback is what prevents the login screen flashing for
      // an already-signed-in user on every reload.
      try {
        const auth = await getFirebaseAuth();
        const { onIdTokenChanged } = await import("firebase/auth");

        const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
          if (cancelled) return;
          hasFirebaseUserRef.current = Boolean(firebaseUser);

          if (firebaseUser) {
            await loadSession();
          } else if (!demoTokenRef.current) {
            applySignedOutState();
          }
        });

        return unsubscribe;
      } catch {
        // A malformed Firebase config should not trap the user on a spinner.
        if (!cancelled) setStatus("unauthenticated");
      }
    };

    const cleanup = restore();

    return () => {
      cancelled = true;
      void cleanup.then((unsubscribe) => unsubscribe?.());
    };
  }, [loadSession, applySignedOutState]);

  const signInWithGoogleAccount = useCallback(async () => {
    setError(null);
    setSigningIn("google");
    try {
      await signInWithGoogle();
      hasFirebaseUserRef.current = true;
      await loadSession();
    } catch (caught) {
      setError(describeFirebaseError(caught));
      hasFirebaseUserRef.current = false;
      setStatus("unauthenticated");
    } finally {
      setSigningIn(null);
    }
  }, [loadSession]);

  const signInAsDemo = useCallback(async () => {
    setError(null);
    setSigningIn("demo");
    try {
      const session = await authApi.demoLogin();
      storeDemoToken(session.access_token, session.expires_at);
      demoTokenRef.current = session.access_token;
      setUser(session.user);
      setStatus("authenticated");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not start the demo session.",
      );
      setStatus("unauthenticated");
    } finally {
      setSigningIn(null);
    }
  }, []);

  const signOut = useCallback(async () => {
    // Tell the backend first, while the token is still valid. A failure here
    // is not worth blocking on — both token types are stateless, so discarding
    // them client-side is what actually ends the session.
    try {
      await authApi.logout();
    } catch {
      // Intentionally ignored; the local sign-out below is authoritative.
    }

    await signOutFromFirebase();
    applySignedOutState();
  }, [applySignedOutState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      googleEnabled: isFirebaseConfigured && serverGoogleEnabled,
      signingIn,
      error,
      signInWithGoogleAccount,
      signInAsDemo,
      signOut,
      clearError: () => setError(null),
    }),
    [
      status,
      user,
      serverGoogleEnabled,
      signingIn,
      error,
      signInWithGoogleAccount,
      signInAsDemo,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return context;
}
