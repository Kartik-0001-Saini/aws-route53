import { cn } from "@/lib/utils/cn";

const SIZE_CLASSES = {
  sm: "h-3.5 w-3.5 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-8 w-8 border-[3px]",
} as const;

export interface SpinnerProps {
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
  /** Announced to screen readers. Set to null inside an already-labelled control. */
  label?: string | null;
}

/**
 * The console's loading indicator: a ring with one transparent quadrant.
 *
 * `currentColor` on three borders means it inherits whatever colour it sits
 * in — white inside a primary button, blue on a page background — without a
 * variant prop.
 */
export function Spinner({ size = "md", className, label = "Loading" }: SpinnerProps) {
  return (
    <span
      role="status"
      className={cn(
        "inline-block animate-spin rounded-full",
        "border-current border-t-transparent",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
