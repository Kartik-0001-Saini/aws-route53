import { cn } from "@/lib/utils/cn";

/**
 * The console's small status pill — used for zone type and record type.
 *
 * `neutral` is the default and covers most cases; the coloured variants are
 * reserved for genuine status, so a table does not turn into a colour chart.
 */
export type BadgeVariant = "neutral" | "blue" | "green" | "red" | "amber";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "bg-hover text-secondary border-divider",
  blue: "bg-info-bg text-info border-info",
  green: "bg-success-bg text-success border-success",
  red: "bg-error-bg text-error border-error",
  amber: "bg-warning-bg text-warning border-warning",
};

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({
  children,
  variant = "neutral",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-badge)] border",
        "px-1.5 py-0.5 text-xs font-bold leading-none whitespace-nowrap",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
