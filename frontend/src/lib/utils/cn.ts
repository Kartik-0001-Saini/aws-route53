import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compose class names, with later Tailwind utilities winning over earlier ones.
 *
 * `clsx` handles conditionals; `twMerge` resolves conflicts, so a component's
 * default `px-4` is genuinely replaced by a caller's `px-6` instead of both
 * landing in the class list and the outcome depending on stylesheet order.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
