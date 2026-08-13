"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  /** Monospace, for record values where alignment and exact characters matter. */
  mono?: boolean;
}

/**
 * The console's multi-line input.
 *
 * Used for record values, where each line is one value in a record set — so it
 * defaults to monospace and disables horizontal resize, which would otherwise
 * let a user drag it wider than its container.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ invalid = false, mono = false, className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "w-full resize-y rounded-[var(--radius-input)] border px-3 py-1.5",
          "bg-input text-sm text-body placeholder:text-disabled",
          "transition-colors",
          mono && "font-mono text-xs leading-relaxed",
          invalid ? "border-error" : "border-input-border",
          "disabled:cursor-not-allowed disabled:bg-input-disabled disabled:text-disabled",
          className,
        )}
        {...props}
      />
    );
  },
);
