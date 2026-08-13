"use client";

import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * A labelled form control, in the console's layout: label, optional
 * description, the control, then either an error or a hint below it.
 *
 * Owns the id wiring so every field gets `aria-describedby` and
 * `aria-invalid` correctly without each form remembering to do it. The control
 * is supplied through a render prop for that reason — it needs the generated
 * ids, and passing them back is more reliable than asking each caller to
 * thread them through.
 */
export interface FormFieldProps {
  label: string;
  /** Explanatory text between the label and the control. */
  description?: string;
  /** Short hint below the control. Hidden while an error is showing. */
  hint?: ReactNode;
  error?: string;
  /** Marks the field required and appends the console's "- optional" when not. */
  required?: boolean;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
  }) => ReactNode;
  className?: string;
}

export function FormField({
  label,
  description,
  hint,
  error,
  required = false,
  children,
  className,
}: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  // An error replaces the hint rather than stacking with it — two messages
  // under one control is noise, and the error is the one that matters.
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-sm font-bold text-label">
        {label}
        {!required && (
          <span className="ml-1 font-normal text-secondary">- optional</span>
        )}
      </label>

      {description && (
        <p className="text-sm text-secondary">{description}</p>
      )}

      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}

      {error ? (
        <p id={errorId} role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
