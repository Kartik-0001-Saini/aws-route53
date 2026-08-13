"use client";

import { ChevronDown } from "lucide-react";
import { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: readonly SelectOption[];
  invalid?: boolean;
  /** Leading blank option, e.g. "Choose a record type". */
  placeholder?: string;
}

/**
 * The console's dropdown.
 *
 * A native `<select>` with the chevron drawn over it, rather than a custom
 * listbox: it gets keyboard navigation, type-ahead and the platform's mobile
 * picker for free, all of which a hand-rolled menu would have to reimplement
 * and usually gets wrong.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { options, invalid = false, placeholder, className, ...props },
    ref,
  ) {
    return (
      <div className="relative">
        <select
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-8 w-full appearance-none rounded-[var(--radius-input)] border",
            "bg-input py-0 pl-3 pr-8 text-sm text-body",
            "transition-colors",
            invalid ? "border-error" : "border-input-border",
            "disabled:cursor-not-allowed disabled:bg-input-disabled disabled:text-disabled",
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary"
          aria-hidden="true"
        />
      </div>
    );
  },
);
