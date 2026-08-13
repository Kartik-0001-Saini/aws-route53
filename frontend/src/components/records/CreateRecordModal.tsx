"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/lib/api/client";
import { dnsRecordsApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { useNotifications } from "@/lib/notifications/notification-context";
import type { HostedZoneDetail } from "@/types/api";

import { RecordFormFields } from "./RecordFormFields";
import {
  canSubmitRecordForm,
  emptyRecordForm,
  formToPayload,
  type RecordFormState,
} from "./record-form-state";

/**
 * Create a DNS record in a hosted zone.
 *
 * Validation lives on the backend — this only reports what it says. Duplicating
 * the per-type rules here would mean two implementations of "is this a valid
 * MX value" that drift the moment one changes.
 */
export interface CreateRecordModalProps {
  onClose: () => void;
  zone: HostedZoneDetail;
}

export function CreateRecordModal({ onClose, zone }: CreateRecordModalProps) {
  const queryClient = useQueryClient();
  const { notifySuccess } = useNotifications();

  // Mounted only while open, so these initialise fresh on every open and no
  // reset effect is needed.
  const [form, setForm] = useState<RecordFormState>(emptyRecordForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const createRecord = useMutation({
    mutationFn: () => dnsRecordsApi.create(zone.zone_id, formToPayload(form)),

    onSuccess: (record) => {
      // The zone's record count changed too, so invalidate both the record
      // list and everything under the zone keys.
      void queryClient.invalidateQueries({ queryKey: queryKeys.zones.all });
      notifySuccess(
        `${record.type} record ${record.name} was created successfully.`,
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
        setFormError("Could not create the record. Try again.");
      }
    },
  });

  const handleChange = (patch: Partial<RecordFormState>) => {
    setForm((current) => ({ ...current, ...patch }));

    // Clear the error on any field the user just touched, so a message does
    // not linger under a value they have already corrected.
    const touched = Object.keys(patch);
    setFieldErrors((current) => {
      if (touched.length === 0) return current;

      const next = { ...current };
      for (const key of touched) delete next[toApiField(key)];

      // Changing the type invalidates any error about the value: what counts
      // as a valid value is decided by the type. Leaving it would show
      // "'999.1.1.1' is not valid" under an MX field, and — because an error
      // replaces the hint — hide the MX format guidance the user now needs.
      if ("type" in patch) delete next.value;

      return next;
    });
  };

  const submit = () => {
    setFieldErrors({});
    setFormError(null);
    createRecord.mutate();
  };

  const canSubmit = canSubmitRecordForm(form) && !createRecord.isPending;

  return (
    <Modal
      onClose={onClose}
      title="Create record"
      description={`Add a DNS record to ${zone.name}.`}
      dismissDisabled={createRecord.isPending}
      footer={
        <>
          <Button
            variant="link"
            onClick={onClose}
            disabled={createRecord.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={createRecord.isPending}
            disabled={!canSubmit}
          >
            Create record
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) submit();
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
          onChange={handleChange}
          zoneName={zone.name}
          fieldErrors={fieldErrors}
          disabled={createRecord.isPending}
        />
      </form>
    </Modal>
  );
}

/**
 * Map a form field name to the name the API uses for its errors.
 *
 * The form is camelCase and the API is snake_case; without this, clearing
 * `setIdentifier` would never clear the error keyed `set_identifier`.
 */
function toApiField(formField: string): string {
  const map: Record<string, string> = {
    setIdentifier: "set_identifier",
    failoverType: "failover_type",
    aliasTarget: "alias_target",
    routingPolicy: "routing_policy",
    isAlias: "is_alias",
  };
  return map[formField] ?? formField;
}
