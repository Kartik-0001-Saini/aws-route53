"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Textarea } from "@/components/ui/Textarea";
import { ApiError } from "@/lib/api/client";
import { hostedZonesApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { useNotifications } from "@/lib/notifications/notification-context";
import type { HostedZoneType } from "@/types/api";

/**
 * The Create hosted zone form, matching the console's own fields: domain name,
 * description, and a type choice that reveals the VPC association when
 * private.
 *
 * On success it navigates to the new zone, as Route 53 does — the next thing
 * anyone wants after creating a zone is its name servers.
 */

const ZONE_TYPE_OPTIONS: readonly {
  value: HostedZoneType;
  label: string;
  description: string;
}[] = [
  {
    value: "public",
    label: "Public hosted zone",
    description:
      "A public hosted zone determines how traffic is routed on the internet.",
  },
  {
    value: "private",
    label: "Private hosted zone",
    description:
      "A private hosted zone determines how traffic is routed within an Amazon VPC.",
  },
];

const AWS_REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "eu-west-1",
  "eu-central-1",
  "ap-south-1",
  "ap-southeast-1",
  "ap-northeast-1",
];

export interface CreateHostedZoneModalProps {
  onClose: () => void;
}

export function CreateHostedZoneModal({
  onClose,
}: CreateHostedZoneModalProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { notifySuccess } = useNotifications();

  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [type, setType] = useState<HostedZoneType>("public");
  const [vpcId, setVpcId] = useState("");
  const [vpcRegion, setVpcRegion] = useState(AWS_REGIONS[6]);

  // Mounted only while open, so state initialises fresh each time.
  // Field errors come from the API, which is the only thing that knows whether
  // a domain is already taken. Local state so they clear as the user retypes.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const createZone = useMutation({
    mutationFn: () =>
      hostedZonesApi.create({
        name: name.trim(),
        type,
        comment: comment.trim() || null,
        vpc_id: type === "private" ? vpcId.trim() || null : null,
        vpc_region: type === "private" ? vpcRegion : null,
      }),

    onSuccess: (zone) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.zones.all });
      notifySuccess(
        `Hosted zone ${zone.name} was created successfully.`,
        "Success",
      );
      onClose();
      router.push(`/hosted-zones/${zone.zone_id}`);
    },

    onError: (error) => {
      if (error instanceof ApiError) {
        setFieldErrors(error.fields);
        // Only surface a form-level message when the failure is not already
        // pinned to a field, so the user does not read the same thing twice.
        setFormError(
          Object.keys(error.fields).length === 0 ? error.message : null,
        );
      } else {
        setFormError("Could not create the hosted zone. Try again.");
      }
    },
  });

  const handleSubmit = () => {
    setFieldErrors({});
    setFormError(null);
    createZone.mutate();
  };

  const canSubmit =
    name.trim().length > 0 &&
    (type === "public" || vpcId.trim().length > 0) &&
    !createZone.isPending;

  return (
    <Modal
      onClose={onClose}
      title="Create hosted zone"
      description="A hosted zone holds the DNS records that describe how traffic is routed for a domain and its subdomains."
      dismissDisabled={createZone.isPending}
      footer={
        <>
          <Button
            variant="link"
            onClick={onClose}
            disabled={createZone.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={createZone.isPending}
            disabled={!canSubmit}
          >
            Create hosted zone
          </Button>
        </>
      }
    >
      <form
        // Enter should submit, as it does in the real console. The button is
        // type="button", so the form's own submit handler is what wires it up.
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) handleSubmit();
        }}
        className="flex flex-col gap-4"
      >
        {formError && (
          <div
            role="alert"
            className="rounded-[var(--radius-input)] border border-error bg-error-bg px-3 py-2 text-sm text-body"
          >
            {formError}
          </div>
        )}

        <FormField
          label="Domain name"
          required
          error={fieldErrors.name}
          description="The domain this hosted zone will manage records for."
          hint="For example: example.com"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="example.com"
              invalid={Boolean(fieldErrors.name)}
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </FormField>

        <FormField
          label="Description"
          error={fieldErrors.comment}
          hint="Up to 256 characters."
        >
          {(fieldProps) => (
            <Textarea
              {...fieldProps}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={2}
              maxLength={256}
              placeholder="What this hosted zone is for"
              invalid={Boolean(fieldErrors.comment)}
            />
          )}
        </FormField>

        <RadioGroup
          legend="Type"
          options={ZONE_TYPE_OPTIONS}
          value={type}
          onChange={setType}
        />

        {type === "private" && (
          <div className="flex flex-col gap-4 rounded-[var(--radius-input)] border border-subtle bg-page p-4">
            <p className="text-sm text-secondary">
              A private hosted zone must be associated with a VPC. It receives
              no public name servers.
            </p>

            <FormField
              label="VPC ID"
              required
              error={fieldErrors.vpc_id}
              hint="For example: vpc-0a1b2c3d4e5f6a7b8"
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  value={vpcId}
                  onChange={(event) => setVpcId(event.target.value)}
                  placeholder="vpc-0a1b2c3d4e5f6a7b8"
                  invalid={Boolean(fieldErrors.vpc_id)}
                  autoComplete="off"
                  spellCheck={false}
                />
              )}
            </FormField>

            <FormField label="Region" required error={fieldErrors.vpc_region}>
              {(fieldProps) => (
                <select
                  {...fieldProps}
                  value={vpcRegion}
                  onChange={(event) => setVpcRegion(event.target.value)}
                  className="h-8 w-full rounded-[var(--radius-input)] border border-input-border bg-input px-3 text-sm text-body"
                >
                  {AWS_REGIONS.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </div>
        )}
      </form>
    </Modal>
  );
}
