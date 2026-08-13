import type { ReactNode } from "react";

/**
 * The console's in-table empty state: a bold line, a grey explanation, and the
 * action that resolves it.
 *
 * Deliberately distinguishes "nothing exists yet" from "nothing matched your
 * filters" at the call site — offering "Create hosted zone" to someone whose
 * search simply found nothing is the wrong answer to their problem.
 */
export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <p className="text-sm font-bold text-heading">{title}</p>
      {description && (
        <p className="max-w-md text-sm text-secondary">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
