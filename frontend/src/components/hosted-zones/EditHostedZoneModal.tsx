"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { ApiError } from "@/lib/api/client";
import { hostedZonesApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { useNotifications } from "@/lib/notifications/notification-context";
import type { HostedZoneSummary } from "@/types/api";

/**
 * Edit a hosted zone.
 *
 * Only the description is editable, because that is the only thing Route 53
 * lets you change — renaming a zone or switching its type would invalidate its
 * delegation set, so both are create-and-delete operations there and here. The
 * immutable values are shown as read-only rows so the dialog still confirms
 * which zone is being edited.
 */
export interface EditHostedZoneModalProps {
  zone: HostedZoneSummary;
  onClose: () => void;
}

export function EditHostedZoneModal({
  zone,
  onClose,
}: EditHostedZoneModalProps) {
  const queryClient = useQueryClient();
  const { notifySuccess } = useNotifications();

  const [comment, setComment] = useState(zone.comment ?? "");
  const [error, setError] = useState<string | null>(null);

  const updateZone = useMutation({
    mutationFn: () => {
      return hostedZonesApi.update(zone.zone_id, {
        comment: comment.trim() || null,
      });
    },

    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.zones.all });
      notifySuccess(`Hosted zone ${updated.name} was updated.`, "Success");
      onClose();
    },

    onError: (caught) => {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not update the hosted zone. Try again.",
      );
    },
  });

  return (
    <Modal
      onClose={onClose}
      title="Edit hosted zone"
      size="sm"
      dismissDisabled={updateZone.isPending}
      footer={
        <>
          <Button
            variant="link"
            onClick={onClose}
            disabled={updateZone.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => updateZone.mutate()}
            loading={updateZone.isPending}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!updateZone.isPending) updateZone.mutate();
        }}
        className="flex flex-col gap-4"
      >
        {error && (
          <div
            role="alert"
            className="rounded-[var(--radius-input)] border border-error bg-error-bg px-3 py-2 text-sm text-body"
          >
            {error}
          </div>
        )}

        <dl className="flex flex-col gap-2 rounded-[var(--radius-input)] bg-page px-3 py-2.5">
          <div className="flex justify-between gap-4 text-sm">
            <dt className="text-secondary">Domain name</dt>
            <dd className="font-bold text-body">{zone.name}</dd>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <dt className="text-secondary">Type</dt>
            <dd className="text-body">
              {zone.type === "public" ? "Public" : "Private"}
            </dd>
          </div>
        </dl>

        <FormField
          label="Description"
          hint="Up to 256 characters. The domain name and type cannot be changed after creation."
        >
          {(fieldProps) => (
            <Textarea
              {...fieldProps}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              maxLength={256}
              placeholder="What this hosted zone is for"
            />
          )}
        </FormField>
      </form>
    </Modal>
  );
}
