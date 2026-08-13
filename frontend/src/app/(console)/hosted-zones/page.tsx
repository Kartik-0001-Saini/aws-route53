"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { CreateHostedZoneModal } from "@/components/hosted-zones/CreateHostedZoneModal";
import { DeleteHostedZoneModal } from "@/components/hosted-zones/DeleteHostedZoneModal";
import { EditHostedZoneModal } from "@/components/hosted-zones/EditHostedZoneModal";
import { PageLayout } from "@/components/layout/PageLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { ShortcutsHelpModal } from "@/components/ui/ShortcutsHelpModal";
import { Table, type Column, type SortState } from "@/components/ui/Table";
import { ApiError } from "@/lib/api/client";
import { hostedZonesApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import {
  focusSearchInput,
  useKeyboardShortcuts,
  type Shortcut,
} from "@/lib/hooks/useKeyboardShortcuts";
import { formatDate, pluralise } from "@/lib/utils/format";
import type {
  HostedZoneListQuery,
  HostedZoneSummary,
  HostedZoneType,
} from "@/types/api";

const PAGE_SIZE = 10;

const TYPE_FILTERS: { label: string; value: HostedZoneType | "all" }[] = [
  { label: "All types", value: "all" },
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
];

export default function HostedZonesPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<HostedZoneType | "all">("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ by: "name", dir: "asc" });
  const [selectedKeys, setSelectedKeys] = useState<Set<string | number>>(
    new Set(),
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [zoneToEdit, setZoneToEdit] = useState<HostedZoneSummary | null>(null);
  const [zoneToDelete, setZoneToDelete] = useState<HostedZoneSummary | null>(
    null,
  );
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const shortcuts: Shortcut[] = useMemo(
    () => [
      {
        key: "/",
        description: "Search hosted zones",
        handler: () => focusSearchInput("Search hosted zones"),
      },
      {
        key: "c",
        description: "Create a hosted zone",
        handler: () => setCreateOpen(true),
      },
      {
        key: "?",
        description: "Show keyboard shortcuts",
        handler: () => setShortcutsOpen(true),
      },
    ],
    [],
  );

  useKeyboardShortcuts(shortcuts);

  const debouncedSearch = useDebouncedValue(search);

  const query: HostedZoneListQuery = useMemo(
    () => ({
      page,
      page_size: PAGE_SIZE,
      search: debouncedSearch || undefined,
      type: typeFilter === "all" ? undefined : typeFilter,
      sort_by: sort.by as HostedZoneListQuery["sort_by"],
      sort_dir: sort.dir,
    }),
    [page, debouncedSearch, typeFilter, sort],
  );

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.zones.list(query),
    queryFn: ({ signal }) => hostedZonesApi.list(query, signal),
    // Holds the previous page on screen while the next loads, so paging and
    // typing do not blank the table on every keystroke.
    placeholderData: keepPreviousData,
  });

  const zones = useMemo(() => data?.items ?? [], [data]);

  /**
   * Changing what the table shows resets the page and clears the selection.
   *
   * Done in the handlers rather than an effect watching the filters: an effect
   * would render once with a stale page number before correcting itself, and
   * clearing the selection matters for correctness — a key left over from
   * another page would sit in the set while the header actions, which only see
   * visible rows, silently ignored it.
   */
  const resetView = () => {
    setPage(1);
    setSelectedKeys(new Set());
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    resetView();
  };

  const handleTypeFilterChange = (value: HostedZoneType | "all") => {
    setTypeFilter(value);
    resetView();
  };

  const handleSortChange = (next: SortState) => {
    setSort(next);
    resetView();
  };

  const handlePageChange = (next: number) => {
    setPage(next);
    setSelectedKeys(new Set());
  };

  // Load failures raise a flash message through the QueryCache handler in
  // `providers.tsx`; the in-table state below is the second half of that.

  const selectedZones = useMemo(
    () => zones.filter((zone) => selectedKeys.has(zone.zone_id)),
    [zones, selectedKeys],
  );
  const singleSelection = selectedZones.length === 1 ? selectedZones[0] : null;

  const columns: Column<HostedZoneSummary>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Hosted zone name",
        sortable: true,
        cell: (zone) => (
          <Link
            href={`/hosted-zones/${zone.zone_id}`}
            className="font-bold text-link hover:underline"
          >
            {zone.name}
          </Link>
        ),
      },
      {
        id: "type",
        header: "Type",
        sortable: true,
        cell: (zone) => (
          <Badge variant={zone.type === "public" ? "blue" : "neutral"}>
            {zone.type === "public" ? "Public" : "Private"}
          </Badge>
        ),
      },
      {
        id: "record_count",
        header: "Record count",
        sortable: true,
        className: "tabular-nums",
        cell: (zone) => zone.record_count,
      },
      {
        id: "comment",
        header: "Description",
        cell: (zone) => (
          <span className="text-secondary">{zone.comment || "—"}</span>
        ),
      },
      {
        id: "zone_id",
        header: "Hosted zone ID",
        cell: (zone) => (
          <span className="font-mono text-xs text-secondary">
            {zone.zone_id}
          </span>
        ),
      },
      {
        id: "created_at",
        header: "Created",
        sortable: true,
        cell: (zone) => (
          <span className="whitespace-nowrap text-secondary">
            {formatDate(zone.created_at)}
          </span>
        ),
      },
    ],
    [],
  );

  const total = data?.total ?? 0;
  const isFiltered = Boolean(debouncedSearch) || typeFilter !== "all";

  return (
    <PageLayout
      title="Hosted zones"
      counter={data ? `(${total})` : undefined}
      description="A hosted zone holds the DNS records that describe how traffic is routed for a domain and its subdomains."
      actions={
        <>
          <Button
            variant="normal"
            onClick={() => void refetch()}
            loading={isFetching && !isPending}
            aria-label="Refresh hosted zones"
            iconLeft={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh
          </Button>

          {/* Both act on exactly one row, matching the console — editing or
              deleting several zones at once has no equivalent there. */}
          <Button
            variant="normal"
            disabled={!singleSelection}
            onClick={() => setZoneToEdit(singleSelection)}
          >
            Edit
          </Button>
          <Button
            variant="normal"
            disabled={!singleSelection}
            onClick={() => setZoneToDelete(singleSelection)}
          >
            Delete zone
          </Button>

          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            Create hosted zone
          </Button>
        </>
      }
    >
      <Container
        disableContentPadding
        filters={
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Search hosted zones by name, description or ID"
              ariaLabel="Search hosted zones"
              className="min-w-64 flex-1"
            />

            <div
              className="flex items-center gap-1"
              role="group"
              aria-label="Filter by type"
            >
              {TYPE_FILTERS.map((filter) => (
                <Button
                  key={filter.value}
                  variant={typeFilter === filter.value ? "primary" : "normal"}
                  onClick={() => handleTypeFilterChange(filter.value)}
                  aria-pressed={typeFilter === filter.value}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
        }
      >
        <Table
          ariaLabel="Hosted zones"
          columns={columns}
          rows={zones}
          rowKey={(zone) => zone.zone_id}
          loading={isPending}
          sort={sort}
          onSortChange={handleSortChange}
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          empty={
            isError ? (
              <EmptyState
                title="Could not load hosted zones"
                description={
                  error instanceof ApiError
                    ? error.message
                    : "Something went wrong."
                }
                action={
                  <Button variant="normal" onClick={() => void refetch()}>
                    Try again
                  </Button>
                }
              />
            ) : isFiltered ? (
              <EmptyState
                title="No matches"
                description="No hosted zones match the current search and filters."
                action={
                  <Button
                    variant="normal"
                    onClick={() => {
                      handleSearchChange("");                      handleTypeFilterChange("all");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No hosted zones"
                description="Create a hosted zone to start managing DNS records for a domain."
                action={
                  <Button
                    variant="primary"
                    onClick={() => setCreateOpen(true)}
                  >
                    Create hosted zone
                  </Button>
                }
              />
            )
          }
        />

        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between gap-4 border-t border-subtle px-4 py-2.5">
            <span className="text-sm text-secondary">
              {pluralise(total, "hosted zone")}
            </span>
            <Pagination
              page={data.page}
              totalPages={data.total_pages}
              onPageChange={handlePageChange}
              disabled={isFetching}
            />
          </div>
        )}
      </Container>

      {/* Mounted only while open, so each dialog's form state initialises from
          the current selection and is discarded on close. */}
      {createOpen && (
        <CreateHostedZoneModal onClose={() => setCreateOpen(false)} />
      )}
      {zoneToEdit && (
        <EditHostedZoneModal
          zone={zoneToEdit}
          onClose={() => setZoneToEdit(null)}
        />
      )}
      {zoneToDelete && (
        <DeleteHostedZoneModal
          zone={zoneToDelete}
          onClose={() => setZoneToDelete(null)}
          onDeleted={() => setSelectedKeys(new Set())}
        />
      )}
      {shortcutsOpen && (
        <ShortcutsHelpModal
          shortcuts={shortcuts}
          onClose={() => setShortcutsOpen(false)}
        />
      )}
    </PageLayout>
  );
}
