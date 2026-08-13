"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";

import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils/cn";

/**
 * The console's data table.
 *
 * Generic over the row type, driven by a column definition array rather than
 * hand-written `<td>`s, so the hosted zone and DNS record tables share their
 * sorting, selection, loading and empty behaviour instead of reimplementing it
 * twice and drifting apart.
 */

export interface Column<T> {
  /** Stable key, also used as the sort field when `sortable` is set. */
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  /** Applied to both the header cell and every body cell in the column. */
  className?: string;
  width?: string;
}

export interface SortState {
  by: string;
  dir: "asc" | "desc";
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  /** Stable row identity — used for keys and selection. */
  rowKey: (row: T) => string | number;

  loading?: boolean;
  /** Shown when there are no rows and nothing is loading. */
  empty?: ReactNode;

  sort?: SortState;
  onSortChange?: (sort: SortState) => void;

  /**
   * Enables the checkbox column. Omit for a read-only table.
   *
   * Every row is selectable. Records the API refuses to delete are selected
   * like any other and reported as kept by the delete dialog — the console
   * behaves the same way, and a checkbox that silently will not tick is more
   * confusing than a clear "these two were kept".
   */
  selectedKeys?: Set<string | number>;
  onSelectionChange?: (keys: Set<string | number>) => void;

  /** Announced to screen readers in place of a visible caption. */
  ariaLabel: string;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  empty,
  sort,
  onSortChange,
  selectedKeys,
  onSelectionChange,
  ariaLabel,
}: TableProps<T>) {
  const selectable = Boolean(selectedKeys && onSelectionChange);

  const allSelected =
    rows.length > 0 && rows.every((row) => selectedKeys?.has(rowKey(row)));

  const toggleAll = () => {
    if (!selectedKeys || !onSelectionChange) return;

    const next = new Set(selectedKeys);
    if (allSelected) {
      rows.forEach((row) => next.delete(rowKey(row)));
    } else {
      rows.forEach((row) => next.add(rowKey(row)));
    }
    onSelectionChange(next);
  };

  const toggleRow = (row: T) => {
    if (!selectedKeys || !onSelectionChange) return;

    const key = rowKey(row);
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  };

  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !onSortChange) return;

    // Clicking the active column flips direction; a new column starts ascending.
    onSortChange(
      sort?.by === column.id
        ? { by: column.id, dir: sort.dir === "asc" ? "desc" : "asc" }
        : { by: column.id, dir: "asc" },
    );
  };

  const columnCount = columns.length + (selectable ? 1 : 0);

  return (
    // The wrapper scrolls, not the page: a wide record table must not push the
    // whole console sideways.
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm" aria-label={ariaLabel}>
        <thead>
          <tr className="border-y border-divider bg-container-header">
            {selectable && (
              <th scope="col" className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={rows.length === 0}
                  aria-label="Select all rows"
                  className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-primary)] disabled:cursor-not-allowed"
                />
              </th>
            )}

            {columns.map((column) => {
              const isSorted = sort?.by === column.id;

              return (
                <th
                  key={column.id}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  // Communicates sort state to assistive technology, which the
                  // arrow glyph alone does not.
                  aria-sort={
                    isSorted
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : column.sortable
                        ? "none"
                        : undefined
                  }
                  className={cn(
                    "px-4 py-2.5 text-left font-bold text-heading",
                    column.className,
                  )}
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => handleSort(column)}
                      className="inline-flex items-center gap-1 hover:text-link"
                    >
                      {column.header}
                      {isSorted ? (
                        sort.dir === "asc" ? (
                          <ChevronUp className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="h-3 w-3" aria-hidden="true" />
                        )
                      ) : (
                        <ChevronDown
                          className="h-3 w-3 opacity-0 group-hover:opacity-40"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {loading && (
            <tr>
              <td colSpan={columnCount} className="px-4 py-12">
                <div className="flex flex-col items-center gap-2 text-secondary">
                  <Spinner className="text-primary" label="Loading rows" />
                  <span className="text-sm">Loading…</span>
                </div>
              </td>
            </tr>
          )}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columnCount} className="px-4 py-12">
                {empty}
              </td>
            </tr>
          )}

          {!loading &&
            rows.map((row) => {
              const key = rowKey(row);
              const isSelected = selectedKeys?.has(key) ?? false;

              return (
                <tr
                  key={key}
                  className={cn(
                    "border-b border-subtle transition-colors",
                    isSelected ? "bg-selected" : "hover:bg-hover",
                  )}
                >
                  {selectable && (
                    <td className="px-4 py-2.5 align-top">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(row)}
                        aria-label="Select row"
                        className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-primary)]"
                      />
                    </td>
                  )}

                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        "px-4 py-2.5 align-top text-body",
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
