/**
 * Firebase client SDK, initialised lazily and only when configured.
 *
 * The whole module is designed to be absent-safe: with no `NEXT_PUBLIC_FIREBASE_*`
 * values set, `isFirebaseConfigured` is false, nothing is imported at runtime,
 * and the login screen hides the Google button. The demo path stays fully
 * functional, so the app runs on a fresh clone before Firebase exists.
 */

import type { Auth, User } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Whether Google sign-in can be offered.
 *
 * `apiKey` and `projectId` are the two that make a config usable; the rest are
 * only needed by Firebase products this app does not use.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
);

let authInstance: Auth | null = null;

/**
 * The Firebase Auth instance, created on first use.
 *
 * Imported dynamically so the SDK is code-split out of the initial bundle: a
 * visitor who signs in with the demo button never downloads it.
 */
export async function getFirebaseAuth(): Promise<Auth> {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Google sign-in is not configured. Set the NEXT_PUBLIC_FIREBASE_* " +
        "variables and redeploy — they are inlined at build time.",
    );
  }

  if (authInstance) return authInstance;

  const { initializeApp, getApps, getApp } = await import("firebase/app");
  const { getAuth, browserLocalPersistence, setPersistence } = await import(
    "firebase/auth"
  );

  // getApps() guards against re-initialising across a fast-refresh reload.
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  authInstance = getAuth(app);

  // Local persistence is what satisfies the assignment's "session
  // persistence": the refresh token survives a reload and a browser restart,
  // and the SDK exchanges it for a fresh ID token automatically.
  await setPersistence(authInstance, browserLocalPersistence);

  return authInstance;
}

/** Open the Google sign-in popup. Resolves with the signed-in Firebase user. */
export async function signInWithGoogle(): Promise<User> {
  const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
  const auth = await getFirebaseAuth();

  const provider = new GoogleAuthProvider();
  // Always show the chooser: without it, a browser with one Google session
  // signs straight back in, and "sign out then switch account" is impossible.
  provider.setCustomParameters({ prompt: "select_account" });

  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

export async function signOutFromFirebase(): Promise<void> {
  if (!isFirebaseConfigured || !authInstance) return;
  const { signOut } = await import("firebase/auth");
  await signOut(authInstance);
}

/**
 * Translate a Firebase error code into something worth showing a user.
 *
 * The raw codes (`auth/popup-blocked`) are useless in a flash message, and the
 * two most likely failures here — a blocked popup and an unauthorised domain —
 * both have a specific fix the user or the operator can act on.
 */
export function describeFirebaseError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Allow popups for this site, or use the demo sign-in.";
    case "auth/unauthorized-domain":
      return "This domain is not authorised in the Firebase project. Add it under Authentication → Settings → Authorized domains.";
    case "auth/network-request-failed":
      return "Could not reach Google. Check your connection and try again.";
    case "auth/operation-not-allowed":
      return "Google sign-in is not enabled in the Firebase project. Enable it under Authentication → Sign-in method.";
    default:
      return "Could not sign in with Google. Try the demo sign-in instead.";
  }
}
