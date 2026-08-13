"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/lib/api/client";
import { hostedZonesApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { useNotifications } from "@/lib/notifications/notification-context";
import type { HostedZoneSummary } from "@/types/api";

/** Route 53 requires this word typed out before it will delete a hosted zone. */
const CONFIRMATION_WORD = "delete";

/**
 * Delete confirmation.
 *
 * The typed confirmation is the console's own behaviour, and it is worth
 * keeping: deleting a hosted zone destroys its delegation set, so recreating
 * it later hands out different name servers and the domain stops resolving
 * until the registrar is updated. That is not something a misplaced click
 * should be able to do.
 *
 * The backend refuses to delete a zone that still holds user records, which
 * arrives as a 409 and is rendered here as guidance rather than a raw error.
 */
export interface DeleteHostedZoneModalProps {
  zone: HostedZoneSummary;
  onClose: () => void;
  /** Called after a successful delete — used to leave the zone detail page. */
  onDeleted?: () => void;
}

export function DeleteHostedZoneModal({
  zone,
  onClose,
  onDeleted,
}: DeleteHostedZoneModalProps) {
  const queryClient = useQueryClient();
  const { notifySuccess } = useNotifications();

  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [blockedByRecords, setBlockedByRecords] = useState(false);

  const deleteZone = useMutation({
    mutationFn: () => hostedZonesApi.remove(zone.zone_id),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.zones.all });
      notifySuccess(
        `Hosted zone ${zone.name} was deleted successfully.`,
        "Success",
      );
      onClose();
      onDeleted?.();
    },

    onError: (caught) => {
      if (caught instanceof ApiError) {
        setBlockedByRecords(caught.code === "HostedZoneNotEmpty");
        setError(caught.message);
      } else {
        setError("Could not delete the hosted zone. Try again.");
      }
    },
  });

  const confirmed =
    confirmation.trim().toLowerCase() === CONFIRMATION_WORD;

  return (
    <Modal
      onClose={onClose}
      title="Delete hosted zone"
      size="sm"
      dismissDisabled={deleteZone.isPending}
      footer={
        <>
          <Button
            variant="link"
            onClick={onClose}
            disabled={deleteZone.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => deleteZone.mutate()}
            loading={deleteZone.isPending}
            disabled={!confirmed || blockedByRecords}
            className="bg-error hover:bg-error hover:brightness-90"
          >
            Delete
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-body">
          Delete the hosted zone{" "}
          <span className="font-bold">{zone.name}</span>?
        </p>

        <div className="flex items-start gap-2.5 rounded-[var(--radius-input)] border border-warning bg-warning-bg px-3 py-2.5">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-warning"
            aria-hidden="true"
          />
          <p className="text-sm text-body">
            This cannot be undone. The zone&apos;s name servers are released, so
            recreating it later assigns a different set and the domain will stop
            resolving until your registrar is updated.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-[var(--radius-input)] border border-error bg-error-bg px-3 py-2.5 text-sm text-body"
          >
            {error}
            {blockedByRecords && (
              <p className="mt-1.5 text-secondary">
                Open the hosted zone and delete its records first. The NS and
                SOA records at the zone apex are removed automatically.
              </p>
            )}
          </div>
        )}

        {!blockedByRecords && (
          <FormField
            label={`To confirm, type "${CONFIRMATION_WORD}"`}
            required
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={CONFIRMATION_WORD}
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && confirmed) {
                    event.preventDefault();
                    deleteZone.mutate();
                  }
                }}
              />
            )}
          </FormField>
        )}
      </div>
    </Modal>
  );
}
