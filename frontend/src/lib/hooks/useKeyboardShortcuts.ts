"use client";

import { useEffect } from "react";

/**
 * Page-level keyboard shortcuts.
 *
 * Two rules make the difference between a shortcut system that helps and one
 * that fights the user:
 *
 *   1. Never fire while they are typing. A bare `c` must insert a "c" in a
 *      search box, not open a dialog.
 *   2. Never fire while a dialog is open. The dialog owns the keyboard, and a
 *      background shortcut firing behind a modal is invisible and confusing.
 *
 * Both are enforced here rather than left to each caller to remember.
 */

export interface Shortcut {
  /** The key, as `KeyboardEvent.key` — "c", "/", "?". */
  key: string;
  /** Human-readable, for the shortcuts help dialog. */
  description: string;
  handler: () => void;
  /** Allow this one even while a dialog is open. Only Escape-likes should. */
  allowInDialog?: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function useKeyboardShortcuts(
  shortcuts: Shortcut[],
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Modifier combinations belong to the browser and the OS. Claiming
      // Ctrl+F or Cmd+L would be actively hostile.
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (isTypingTarget(event.target)) return;

      const dialogOpen = document.querySelector('[role="dialog"]') !== null;

      const match = shortcuts.find(
        (shortcut) =>
          shortcut.key.toLowerCase() === event.key.toLowerCase() &&
          (!dialogOpen || shortcut.allowInDialog),
      );

      if (!match) return;

      event.preventDefault();
      match.handler();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, enabled]);
}

/**
 * Move focus to a search box.
 *
 * Selects the existing text as well as focusing, so pressing `/` twice
 * replaces the previous query instead of appending to it.
 */
export function focusSearchInput(ariaLabel: string): void {
  const input = document.querySelector<HTMLInputElement>(
    `input[aria-label="${ariaLabel}"]`,
  );
  input?.focus();
  input?.select();
}
