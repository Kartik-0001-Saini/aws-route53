"use client";

import { useId } from "react";

import { cn } from "@/lib/utils/cn";

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  /** Secondary line under the label, as the console uses for zone types. */
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps<T extends string> {
  legend: string;
  options: readonly RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Hides the legend visually but keeps it for screen readers. */
  hideLegend?: boolean;
  className?: string;
}

/**
 * A radio group in the console's style — used where the choice changes the
 * rest of the form, such as public versus private hosted zone.
 *
 * A `<fieldset>` with a real `<legend>`, so assistive technology announces the
 * question along with each option instead of reading five unlabelled radios.
 */
export function RadioGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  hideLegend = false,
  className,
}: RadioGroupProps<T>) {
  const name = useId();

  return (
    <fieldset className={cn("flex flex-col gap-2", className)}>
      <legend
        className={cn(
          "text-sm font-bold text-label",
          hideLegend && "sr-only",
        )}
      >
        {legend}
      </legend>

      {options.map((option) => {
        const id = `${name}-${option.value}`;

        return (
          <div key={option.value} className="flex items-start gap-2">
            <input
              type="radio"
              id={id}
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
              className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-[var(--color-primary)] disabled:cursor-not-allowed"
            />
            <label htmlFor={id} className="cursor-pointer select-none">
              <span className="text-sm text-body">{option.label}</span>
              {option.description && (
                <span className="block text-sm text-secondary">
                  {option.description}
                </span>
              )}
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
