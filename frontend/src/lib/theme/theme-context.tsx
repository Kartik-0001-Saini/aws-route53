"use client";

/**
 * Light/dark theme, matching the AWS console's own switch.
 *
 * The `<html>` class list is the single source of truth, not React state. It
 * is written by an inline script before first paint — so a dark-mode user
 * never sees a white flash — and React reads it through
 * `useSyncExternalStore` rather than copying it into state inside an effect.
 *
 * That choice does three things at once: it avoids the cascading render of a
 * `setState` in an effect, it hydrates without a mismatch (the server snapshot
 * is "light", and React reconciles to the real value on the client), and it
 * keeps every tab in step, because a change in one tab reaches the others
 * through the `storage` event.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "route53-clone.theme";

/**
 * Runs before first paint, inlined in the document head.
 *
 * Kept as a string rather than a module because it has to execute
 * synchronously ahead of hydration — anything bundled would arrive too late to
 * prevent the flash. Falls back to the OS preference on a first visit.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {
    /* Private browsing can throw on localStorage; light mode is a fine default. */
  }
})();
`;

/* ==========================================================================
   The external store: the <html> class list
   ========================================================================== */

const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  // Another tab changing the theme writes to localStorage, which fires here.
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;

    document.documentElement.classList.toggle(
      "dark",
      event.newValue === "dark",
    );
    listener();
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * The server has no way to know the user's choice.
 *
 * Returning "light" is what the markup is rendered against; the inline script
 * has already painted the correct colours, and React corrects the icon on
 * hydration.
 */
function getServerSnapshot(): Theme {
  return "light";
}

/* ==========================================================================
   Context
   ========================================================================== */

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    const next: Theme = getSnapshot() === "dark" ? "light" : "dark";

    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Persisting is a nicety; the toggle still works for this session.
    }

    notifyListeners();
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>.");
  }
  return context;
}
