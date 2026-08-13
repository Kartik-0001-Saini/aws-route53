"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Lock, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/Input";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Pagination } from "@/components/ui/Pagination";
import { Table, type Column, type SortState } from "@/components/ui/Table";
import { ApiError } from "@/lib/api/client";
import { dnsRecordsApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { ALL_RECORD_TYPES, ROUTING_POLICY_INFO } from "@/lib/dns/record-types";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { formatTtl, pluralise } from "@/lib/utils/format";
import type {
  AnyRecordType,
  DnsRecord,
  DnsRecordListQuery,
  HostedZoneDetail,
} from "@/types/api";

import { CreateRecordModal } from "./CreateRecordModal";
import { DeleteRecordsModal } from "./DeleteRecordsModal";
import { EditRecordModal } from "./EditRecordModal";

/**
 * The records table on a hosted zone's page, with everything the console's has
 * around it: search, a multi-select type filter, sorting, pagination, and the
 * create / edit / delete actions.
 */

const PAGE_SIZE = 10;

export interface RecordsSectionProps {
  zone: HostedZoneDetail;
}

export function RecordsSection({ zone }: RecordsSectionProps) {
  const [search, setSearch] = useState("");
  const [types, setTypes] = useState<AnyRecordType[]>([]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ by: "name", dir: "asc" });
  const [selectedKeys, setSelectedKeys] = useState<Set<string | number>>(
    new Set(),
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<DnsRecord | null>(null);
  const [recordsToDelete, setRecordsToDelete] = useState<DnsRecord[]>([]);

  const debouncedSearch = useDebouncedValue(search);

  const query: DnsRecordListQuery = useMemo(
    () => ({
      page,
      page_size: PAGE_SIZE,
      search: debouncedSearch || undefined,
      type: types.length > 0 ? types : undefined,
      sort_by: sort.by as DnsRecordListQuery["sort_by"],
      sort_dir: sort.dir,
    }),
    [page, debouncedSearch, types, sort],
  );

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.records.list(zone.zone_id, query),
    queryFn: ({ signal }) => dnsRecordsApi.list(zone.zone_id, query, signal),
    placeholderData: keepPreviousData,
  });

  const records = useMemo(() => data?.items ?? [], [data]);

  /**
   * Changing what the table shows resets the page and clears the selection.
   *
   * In the handlers rather than an effect: an effect would render once with a
   * stale page before correcting itself, and a selection key left over from
   * another page would sit in the set while the header actions — which only
   * see visible rows — silently ignored it.
   */
  const resetView = () => {
    setPage(1);
    setSelectedKeys(new Set());
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    resetView();
  };

  const handleTypesChange = (next: AnyRecordType[]) => {
    setTypes(next);
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

  const selectedRecords = useMemo(
    () => records.filter((record) => selectedKeys.has(record.id)),
    [records, selectedKeys],
  );
  const singleSelection =
    selectedRecords.length === 1 ? selectedRecords[0] : null;

  const columns: Column<DnsRecord>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Record name",
        sortable: true,
        cell: (record) => (
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-body">{record.name}</span>
            {record.is_system && (
              <Lock
                className="h-3 w-3 shrink-0 text-secondary"
                aria-label="Managed by Route 53"
              />
            )}
          </span>
        ),
      },
      {
        id: "type",
        header: "Type",
        sortable: true,
        cell: (record) => <Badge>{record.type}</Badge>,
      },
      {
        id: "routing_policy",
        header: "Routing policy",
        cell: (record) => (
          <span className="whitespace-nowrap text-secondary">
            {ROUTING_POLICY_INFO[record.routing_policy].label}
          </span>
        ),
      },
      {
        id: "set_identifier",
        header: "Record ID",
        cell: (record) => (
          <span className="text-secondary">{record.set_identifier || "—"}</span>
        ),
      },
      {
        id: "value",
        header: "Value / route traffic to",
        className: "max-w-md",
        cell: (record) =>
          record.is_alias ? (
            <span className="flex items-center gap-1.5">
              <Badge variant="blue">Alias</Badge>
              <span className="font-mono text-xs">{record.alias_target}</span>
            </span>
          ) : (
            // Each value on its own line, as the console shows a record set.
            // `break-words`, not `break-all`: it wraps at spaces and only
            // splits a token that cannot fit on a line by itself. `break-all`
            // would chop the SOA serial mid-number, which reads as corruption.
            <span className="flex flex-col gap-0.5 font-mono text-xs break-words">
              {record.values.map((value, index) => (
                <span key={`${record.id}-${index}`}>{value}</span>
              ))}
            </span>
          ),
      },
      {
        id: "ttl",
        header: "TTL (seconds)",
        sortable: true,
        cell: (record) => (
          <span className="whitespace-nowrap text-secondary">
            {record.is_alias ? "—" : formatTtl(record.ttl)}
          </span>
        ),
      },
    ],
    [],
  );

  const total = data?.total ?? 0;
  const isFiltered = Boolean(debouncedSearch) || types.length > 0;

  return (
    <>
      <Container
        title="Records"
        counter={data ? `(${total})` : undefined}
        disableContentPadding
        actions={
          <>
            <Button
              variant="normal"
              onClick={() => void refetch()}
              loading={isFetching && !isPending}
              aria-label="Refresh records"
              iconLeft={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>

            <Button
              variant="normal"
              // The apex NS and SOA are managed by the zone; the API rejects
              // editing them, so the button reflects that rather than offering
              // an action that always fails.
              disabled={!singleSelection || singleSelection.is_system}
              onClick={() => setRecordToEdit(singleSelection)}
            >
              Edit
            </Button>

            <Button
              variant="normal"
              disabled={selectedRecords.length === 0}
              onClick={() => setRecordsToDelete(selectedRecords)}
            >
              Delete
            </Button>

            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              Create record
            </Button>
          </>
        }
        filters={
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Search records by name, value or record ID"
              ariaLabel="Search records"
              className="min-w-64 flex-1"
            />

            <MultiSelect
              options={ALL_RECORD_TYPES.map((type) => ({
                value: type,
                label: type,
              }))}
              selected={types}
              onChange={handleTypesChange}
              placeholder="All record types"
              ariaLabel="Filter by record type"
              className="w-48"
            />
          </div>
        }
      >
        <Table
          ariaLabel={`DNS records for ${zone.name}`}
          columns={columns}
          rows={records}
          rowKey={(record) => record.id}
          loading={isPending}
          sort={sort}
          onSortChange={handleSortChange}
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          empty={
            isError ? (
              <EmptyState
                title="Could not load records"
                description={
                  error instanceof ApiError ? error.message : "Something went wrong."
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
                description="No records match the current search and filters."
                action={
                  <Button
                    variant="normal"
                    onClick={() => {
                      handleSearchChange("");                      handleTypesChange([]);
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No records"
                description="Create a record to start routing traffic for this domain."
                action={
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    Create record
                  </Button>
                }
              />
            )
          }
        />

        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between gap-4 border-t border-subtle px-4 py-2.5">
            <span className="text-sm text-secondary">
              {pluralise(total, "record")}
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
        <CreateRecordModal onClose={() => setCreateOpen(false)} zone={zone} />
      )}
      {recordToEdit && (
        <EditRecordModal
          record={recordToEdit}
          onClose={() => setRecordToEdit(null)}
          zone={zone}
        />
      )}
      {recordsToDelete.length > 0 && (
        <DeleteRecordsModal
          records={recordsToDelete}
          onClose={() => setRecordsToDelete([])}
          zoneId={zone.zone_id}
          onDeleted={() => setSelectedKeys(new Set())}
        />
      )}
    </>
  );
}
