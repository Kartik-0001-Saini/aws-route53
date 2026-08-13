"use client";

import { Search, X } from "lucide-react";
import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  invalid?: boolean;
}

/** The console's text input: 8px radius, grey border, blue focus ring. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-8 w-full rounded-[var(--radius-input)] border px-3",
        "bg-input text-sm text-body placeholder:text-disabled",
        "transition-colors",
        invalid ? "border-error" : "border-input-border",
        "disabled:cursor-not-allowed disabled:bg-input-disabled disabled:text-disabled",
        className,
      )}
      {...props}
    />
  );
});

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
}

/**
 * The console's filtering search box: a magnifier on the left, and a clear
 * button that appears once there is something to clear.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search",
  ariaLabel,
  className,
}: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary"
        aria-hidden="true"
      />

      <Input
        // `type="text"`, not `type="search"`: the browser's native clear widget
        // is unstyleable and would sit beside our own.
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="pl-9 pr-9"
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 rounded p-1",
            "text-secondary transition-colors hover:bg-hover hover:text-body",
          )}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
