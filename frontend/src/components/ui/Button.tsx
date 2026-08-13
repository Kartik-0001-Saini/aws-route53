"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils/cn";

/**
 * Cloudscape's four button variants.
 *
 *   primary   — the one call to action per view ("Create hosted zone")
 *   normal    — the default; outlined, used for everything else
 *   link      — text-only, for tertiary actions inside dense rows
 *   inline-link — as link, but sized to sit inside a line of text
 */
export type ButtonVariant = "primary" | "normal" | "link" | "inline-link";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: cn(
    "bg-primary text-on-primary border border-transparent",
    "hover:bg-primary-hover active:bg-primary-active",
    "disabled:bg-input-disabled disabled:text-disabled disabled:border-transparent",
  ),
  normal: cn(
    "bg-transparent text-link border border-current",
    "hover:bg-selected hover:text-link-hover",
    "active:bg-selected",
    "disabled:text-disabled disabled:bg-transparent",
  ),
  link: cn(
    "bg-transparent text-link border border-transparent",
    "hover:bg-selected hover:text-link-hover",
    "disabled:text-disabled disabled:bg-transparent",
  ),
  "inline-link": cn(
    "bg-transparent text-link border-0 p-0 h-auto font-normal underline-offset-2",
    "hover:text-link-hover hover:underline",
    "disabled:text-disabled disabled:no-underline",
  ),
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /**
   * Shows a spinner and blocks interaction.
   *
   * Separate from `disabled` on purpose: a loading button is temporarily busy,
   * a disabled one is unavailable, and conflating them makes it impossible to
   * tell whether a click registered.
   */
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "normal",
      loading = false,
      iconLeft,
      iconRight,
      fullWidth = false,
      disabled,
      className,
      children,
      type = "button",
      ...props
    },
    ref,
  ) {
    const isInline = variant === "inline-link";

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        // Tells assistive technology the control is busy rather than broken.
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center gap-2",
          "text-sm font-bold whitespace-nowrap",
          "transition-colors duration-100",
          "disabled:cursor-not-allowed",
          !isInline && "h-8 px-5 rounded-[var(--radius-button)]",
          fullWidth && "w-full",
          VARIANT_CLASSES[variant],
          className,
        )}
        {...props}
      >
        {loading ? (
          <Spinner size="sm" />
        ) : (
          iconLeft && <span className="shrink-0">{iconLeft}</span>
        )}
        {children}
        {iconRight && !loading && <span className="shrink-0">{iconRight}</span>}
      </button>
    );
  },
);
