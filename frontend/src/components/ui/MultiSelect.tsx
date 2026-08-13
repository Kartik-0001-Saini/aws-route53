"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A checkbox dropdown, for filters that accept several values at once — the
 * record type filter above the records table.
 *
 * Custom rather than a native `<select multiple>`, because that renders as an
 * always-open scrolling list box that ctrl-click drives, which nobody expects
 * and which cannot show the "2 selected" summary the console uses.
 */
export interface MultiSelectOption<T extends string> {
  value: T;
  label: string;
}

export interface MultiSelectProps<T extends string> {
  options: readonly MultiSelectOption<T>[];
  selected: readonly T[];
  onChange: (selected: T[]) => void;
  /** Shown when nothing is selected. */
  placeholder: string;
  ariaLabel: string;
  className?: string;
}

export function MultiSelect<T extends string>({
  options,
  selected,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape — the two ways a user expects to dismiss
  // a dropdown they opened by accident.
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const toggle = (value: T) => {
    onChange(
      selected.includes(value)
        ? selected.filter((entry) => entry !== value)
        : [...selected, value],
    );
  };

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((option) => option.value === selected[0])?.label ??
          selected[0]
        : `${selected.length} selected`;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2",
          "rounded-[var(--radius-input)] border border-input-border bg-input px-3",
          "text-sm transition-colors hover:bg-hover",
          selected.length === 0 ? "text-disabled" : "text-body",
        )}
      >
        <span className="truncate">{summary}</span>

        <span className="flex shrink-0 items-center gap-1">
          {selected.length > 0 && (
            // A span, not a button: a nested button is invalid HTML and the
            // browser would hoist it out of the trigger.
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear type filter"
              onClick={(event) => {
                event.stopPropagation();
                onChange([]);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange([]);
                }
              }}
              className="grid h-4 w-4 place-items-center rounded text-secondary hover:bg-divider hover:text-body"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-multiselectable="true"
          aria-label={ariaLabel}
          className={cn(
            "absolute left-0 top-9 z-20 max-h-72 w-full min-w-48 overflow-y-auto",
            "rounded-[var(--radius-input)] border border-divider bg-container",
            "py-1 shadow-[var(--shadow-dropdown)]",
          )}
        >
          {options.map((option) => {
            const isSelected = selected.includes(option.value);

            return (
              <li key={option.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => toggle(option.value)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-body hover:bg-hover"
                >
                  <span
                    className={cn(
                      "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[2px] border",
                      isSelected
                        ? "border-primary bg-primary text-on-primary"
                        : "border-input-border",
                    )}
                  >
                    {isSelected && <Check className="h-2.5 w-2.5" aria-hidden="true" />}
                  </span>
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
