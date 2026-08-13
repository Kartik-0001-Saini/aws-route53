"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/lib/api/client";
import { dnsRecordsApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { useNotifications } from "@/lib/notifications/notification-context";
import type { DnsRecord, HostedZoneDetail } from "@/types/api";

import { RecordFormFields } from "./RecordFormFields";
import {
  canSubmitRecordForm,
  formToUpdatePayload,
  recordToForm,
  type RecordFormState,
} from "./record-form-state";

/**
 * Edit a DNS record.
 *
 * Name and type are locked. In Route 53 they are the record set's identity, so
 * changing one is a delete plus a create rather than an update — the console
 * disables both fields for the same reason, and the API rejects them outright.
 */
export interface EditRecordModalProps {
  record: DnsRecord;
  onClose: () => void;
  zone: HostedZoneDetail;
}

export function EditRecordModal({
  record,
  onClose,
  zone,
}: EditRecordModalProps) {
  const queryClient = useQueryClient();
  const { notifySuccess } = useNotifications();

  // Mounted only while open, and keyed on the record by the caller, so the
  // form initialises from whichever record was chosen without a sync effect.
  const [form, setForm] = useState<RecordFormState>(() =>
    recordToForm(record, zone.name),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const updateRecord = useMutation({
    mutationFn: () =>
      dnsRecordsApi.update(zone.zone_id, record.id, formToUpdatePayload(form)),

    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.zones.all });
      notifySuccess(
        `${updated.type} record ${updated.name} was updated.`,
        "Success",
      );
      onClose();
    },

    onError: (error) => {
      if (error instanceof ApiError) {
        setFieldErrors(error.fields);
        setFormError(
          Object.keys(error.fields).length === 0 ? error.message : null,
        );
      } else {
        setFormError("Could not update the record. Try again.");
      }
    },
  });

  const canSubmit = canSubmitRecordForm(form) && !updateRecord.isPending;

  return (
    <Modal
      onClose={onClose}
      title="Edit record"
      description={`${record.type} record for ${record.name}`}
      dismissDisabled={updateRecord.isPending}
      footer={
        <>
          <Button
            variant="link"
            onClick={onClose}
            disabled={updateRecord.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => updateRecord.mutate()}
            loading={updateRecord.isPending}
            disabled={!canSubmit}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) updateRecord.mutate();
        }}
      >
        {formError && (
          <div
            role="alert"
            className="mb-4 rounded-[var(--radius-input)] border border-error bg-error-bg px-3 py-2 text-sm text-body"
          >
            {formError}
          </div>
        )}

        <RecordFormFields
          form={form}
          onChange={(patch) =>
            setForm((current) => ({ ...current, ...patch }))
          }
          zoneName={zone.name}
          fieldErrors={fieldErrors}
          identityLocked
          disabled={updateRecord.isPending}
        />
      </form>
    </Modal>
  );
}
