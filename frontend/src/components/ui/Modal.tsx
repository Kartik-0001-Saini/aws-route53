"use client";

import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils/cn";

/**
 * The console's modal dialog.
 *
 * Rendered through a portal so it escapes any transformed or `overflow:hidden`
 * ancestor, and given the full dialog treatment rather than a styled div:
 * focus is trapped while it is open and restored to the trigger when it
 * closes, Escape dismisses it, and the page behind it cannot scroll. A modal
 * that leaks focus back to the page is unusable with a keyboard, and that is
 * exactly how a delete confirmation gets dismissed by accident.
 */

const SIZE_CLASSES = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
} as const;

/** Elements that can hold focus, for the tab-cycling trap. */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Note there is no `open` prop.
 *
 * A modal is open if it is rendered, so callers mount it on demand. That is
 * what lets the dialogs inside it initialise their form state in `useState`
 * and drop it on close, instead of keeping a hidden instance alive and
 * resetting it through an effect every time it reopens.
 */
export interface ModalProps {
  onClose: () => void;
  title: string;
  description?: string;
  /** Buttons for the footer, right-aligned as in the console. */
  footer?: ReactNode;
  children: ReactNode;
  size?: keyof typeof SIZE_CLASSES;
  /**
   * Blocks Escape and backdrop dismissal. Set while a submission is in flight,
   * so a half-finished request cannot be abandoned mid-write.
   */
  dismissDisabled?: boolean;
}

export function Modal({
  onClose,
  title,
  description,
  footer,
  children,
  size = "md",
  dismissDisabled = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const requestClose = useCallback(() => {
    if (!dismissDisabled) onClose();
  }, [dismissDisabled, onClose]);

  // Focus management and the keyboard trap.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Focus the first control so a keyboard user starts inside the dialog
    // rather than at the top of the page behind it.
    const focusFirst = () => {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTOR,
      );
      (focusable?.[0] ?? dialogRef.current)?.focus();
    };
    const frame = requestAnimationFrame(focusFirst);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        requestClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
          [],
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      // Wrap in both directions so Tab can never reach the page behind.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Lock background scrolling, restoring whatever the page had before.
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused.current?.focus();
    };
  }, [requestClose]);

  // The portal target only exists in the browser; bail out during SSR.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={requestClose}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 my-auto w-full",
          "rounded-[var(--radius-container)] bg-container",
          "shadow-[var(--shadow-modal)]",
          SIZE_CLASSES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-heading">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-secondary">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={requestClose}
            disabled={dismissDisabled}
            aria-label="Close dialog"
            className={cn(
              "-mr-2 -mt-1 shrink-0 rounded p-1.5 text-secondary transition-colors",
              "hover:bg-hover hover:text-body",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 py-3">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-6 pb-5 pt-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
