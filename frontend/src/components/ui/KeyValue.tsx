import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The console's key-value detail grid: a label above its value, laid out in
 * columns that collapse on narrow screens.
 *
 * A real `<dl>` rather than divs, so the label-value relationship survives for
 * screen readers instead of being purely visual.
 */

export interface KeyValuePair {
  label: string;
  value: ReactNode;
}

export interface KeyValueGridProps {
  items: KeyValuePair[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const COLUMN_CLASSES = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

export function KeyValueGrid({
  items,
  columns = 3,
  className,
}: KeyValueGridProps) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-8 gap-y-4", COLUMN_CLASSES[columns], className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="mb-1 text-sm font-bold text-label">{item.label}</dt>
          <dd className="text-sm text-body">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
