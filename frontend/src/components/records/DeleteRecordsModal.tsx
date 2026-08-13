"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/lib/api/client";
import { dnsRecordsApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { useNotifications } from "@/lib/notifications/notification-context";
import { pluralise } from "@/lib/utils/format";
import type { DnsRecord } from "@/types/api";

/**
 * Delete one or several records.
 *
 * One dialog for both cases, because the difference is a count. It lists what
 * is about to go — a confirmation that only says "delete 7 records?" is not
 * something anyone can actually check before agreeing to it.
 */
export interface DeleteRecordsModalProps {
  records: DnsRecord[];
  onClose: () => void;
  zoneId: string;
  /** Called after a successful delete, to clear the table's selection. */
  onDeleted?: () => void;
}

/** How many rows to list before collapsing the rest into a summary line. */
const MAX_LISTED = 8;

export function DeleteRecordsModal({
  records,
  onClose,
  zoneId,
  onDeleted,
}: DeleteRecordsModalProps) {
  const queryClient = useQueryClient();
  const { notifySuccess, notify } = useNotifications();
  const [error, setError] = useState<string | null>(null);

  const deletable = records.filter((record) => !record.is_system);
  const systemRecords = records.filter((record) => record.is_system);

  const deleteRecords = useMutation({
    mutationFn: () => {
      const ids = deletable.map((record) => record.id);

      // A single delete gets the single-record endpoint, so the API's 409 for
      // a system record surfaces as an error instead of a silent skip.
      if (ids.length === 1) {
        return dnsRecordsApi
          .remove(zoneId, ids[0])
          .then(() => ({ deleted: 1, skipped: [] as number[] }));
      }
      return dnsRecordsApi.bulkRemove(zoneId, ids);
    },

    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.zones.all });

      notifySuccess(
        `${pluralise(result.deleted, "record")} deleted successfully.`,
        "Success",
      );

      // Report skips rather than letting the success message imply everything
      // in the selection is gone.
      if (result.skipped.length > 0) {
        notify({
          type: "info",
          header: "Some records were kept",
          message: `${pluralise(result.skipped.length, "record")} at the zone apex are managed by Route 53 and cannot be deleted.`,
        });
      }

      onClose();
      onDeleted?.();
    },

    onError: (caught) => {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not delete the records. Try again.",
      );
    },
  });

  const listed = records.slice(0, MAX_LISTED);
  const overflow = records.length - listed.length;

  return (
    <Modal
      onClose={onClose}
      title={
        records.length === 1
          ? "Delete record"
          : `Delete ${pluralise(records.length, "record")}`
      }
      size="sm"
      dismissDisabled={deleteRecords.isPending}
      footer={
        <>
          <Button
            variant="link"
            onClick={onClose}
            disabled={deleteRecords.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => deleteRecords.mutate()}
            loading={deleteRecords.isPending}
            disabled={deletable.length === 0}
            className="bg-error hover:bg-error hover:brightness-90"
          >
            Delete
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-body">
          {deletable.length === 0
            ? "Nothing in this selection can be deleted."
            : `Delete ${pluralise(deletable.length, "record")}? DNS changes can take up to the record's TTL to propagate.`}
        </p>

        <ul className="flex flex-col gap-1.5 rounded-[var(--radius-input)] bg-page px-3 py-2.5">
          {listed.map((record) => (
            <li
              key={record.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate font-mono text-xs text-body">
                {record.name}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge>{record.type}</Badge>
                {record.is_system && (
                  <span className="text-xs text-secondary">kept</span>
                )}
              </span>
            </li>
          ))}

          {overflow > 0 && (
            <li className="text-xs text-secondary">
              and {overflow} more…
            </li>
          )}
        </ul>

        {systemRecords.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-[var(--radius-input)] border border-warning bg-warning-bg px-3 py-2.5">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-warning"
              aria-hidden="true"
            />
            <p className="text-sm text-body">
              {pluralise(systemRecords.length, "record")} at the zone apex
              {systemRecords.length === 1 ? " is" : " are"} managed by Route 53
              and will be kept.
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-[var(--radius-input)] border border-error bg-error-bg px-3 py-2.5 text-sm text-body"
          >
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
