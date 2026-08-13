"use client";

import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  CREATABLE_RECORD_TYPES,
  RECORD_TYPE_INFO,
  ROUTING_POLICIES,
  ROUTING_POLICY_INFO,
  TTL_PRESETS,
} from "@/lib/dns/record-types";
import { cn } from "@/lib/utils/cn";
import type { FailoverType, RecordType, RoutingPolicy } from "@/types/api";

import type { RecordFormState } from "./record-form-state";

/**
 * The record form, shared by the create and edit dialogs.
 *
 * Laid out like the console's: the name as a prefix beside the static zone
 * name, then type, value, TTL, and a routing section that reveals only the
 * fields the chosen policy needs. Showing weight, region and failover all at
 * once would be four inputs of which three are always wrong.
 */

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

const FAILOVER_OPTIONS: { value: FailoverType; label: string }[] = [
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
];

export interface RecordFormFieldsProps {
  form: RecordFormState;
  onChange: (patch: Partial<RecordFormState>) => void;
  zoneName: string;
  /** Field-level messages from the API, keyed as the backend sends them. */
  fieldErrors: Record<string, string>;
  /** Name and type are the record set's identity and are fixed when editing. */
  identityLocked?: boolean;
  disabled?: boolean;
}

export function RecordFormFields({
  form,
  onChange,
  zoneName,
  fieldErrors,
  identityLocked = false,
  disabled = false,
}: RecordFormFieldsProps) {
  const typeInfo = RECORD_TYPE_INFO[form.type];
  const requires = ROUTING_POLICY_INFO[form.routingPolicy].requires;

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Identity ---------------------------------------------------- */}
      <FormField
        label="Record name"
        error={fieldErrors.name}
        hint={
          identityLocked
            ? "The record name cannot be changed. Delete the record and create a new one instead."
            : `Leave blank to create a record for ${zoneName} itself.`
        }
      >
        {(fieldProps) => (
          <div className="flex items-stretch">
            <Input
              {...fieldProps}
              value={form.name}
              onChange={(event) => onChange({ name: event.target.value })}
              placeholder="www"
              disabled={disabled || identityLocked}
              invalid={Boolean(fieldErrors.name)}
              autoComplete="off"
              spellCheck={false}
              className="rounded-r-none"
            />
            {/* The zone name as static text, exactly as the console shows it —
                which is why the API accepts a bare prefix. */}
            <span
              className={cn(
                "flex items-center whitespace-nowrap rounded-r-[var(--radius-input)]",
                "border border-l-0 border-input-border bg-input-disabled px-3",
                "text-sm text-secondary",
              )}
            >
              .{zoneName}
            </span>
          </div>
        )}
      </FormField>

      <FormField
        label="Record type"
        required
        error={fieldErrors.type}
        hint={typeInfo.description}
      >
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={form.type}
            onChange={(event) =>
              onChange({ type: event.target.value as RecordType })
            }
            disabled={disabled || identityLocked}
            invalid={Boolean(fieldErrors.type)}
            options={CREATABLE_RECORD_TYPES.map((type) => ({
              value: type,
              label: RECORD_TYPE_INFO[type].label,
            }))}
          />
        )}
      </FormField>

      {/* ---- Alias ------------------------------------------------------- */}
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id="record-is-alias"
          checked={form.isAlias}
          disabled={disabled}
          onChange={(event) => onChange({ isAlias: event.target.checked })}
          // The explanation is a description, not part of the name. Nesting it
          // in the <label> would make the checkbox's accessible name the whole
          // paragraph — which reads badly aloud, and makes "Alias" ambiguous
          // against the neighbouring Value field for anything matching on it.
          aria-describedby="record-is-alias-description"
          className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-[var(--color-primary)]"
        />
        <div>
          <label
            htmlFor="record-is-alias"
            className="cursor-pointer select-none text-sm font-bold text-label"
          >
            Alias
          </label>
          <p id="record-is-alias-description" className="text-sm text-secondary">
            Point at an AWS resource instead of a value. Alias records take
            their target&apos;s TTL.
          </p>
        </div>
      </div>

      {/* ---- Value or alias target --------------------------------------- */}
      {form.isAlias ? (
        <FormField
          label="Route traffic to"
          required
          error={fieldErrors.alias_target}
          hint="In this clone the target is free text; the real console offers a resource picker."
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={form.aliasTarget}
              onChange={(event) => onChange({ aliasTarget: event.target.value })}
              placeholder="d111111abcdef8.cloudfront.net"
              disabled={disabled}
              invalid={Boolean(fieldErrors.alias_target)}
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </FormField>
      ) : (
        <>
          <FormField
            label="Value"
            required
            error={fieldErrors.value}
            hint={typeInfo.valueHint}
          >
            {(fieldProps) => (
              <Textarea
                {...fieldProps}
                mono
                rows={typeInfo.multiValue ? 4 : 2}
                value={form.value}
                onChange={(event) => onChange({ value: event.target.value })}
                placeholder={typeInfo.placeholder}
                disabled={disabled}
                invalid={Boolean(fieldErrors.value)}
                spellCheck={false}
              />
            )}
          </FormField>

          <FormField
            label="TTL (seconds)"
            required
            error={fieldErrors.ttl}
            hint="How long resolvers cache this record."
          >
            {(fieldProps) => (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  {...fieldProps}
                  type="number"
                  min={0}
                  max={2147483647}
                  value={form.ttl}
                  onChange={(event) => onChange({ ttl: event.target.value })}
                  disabled={disabled}
                  invalid={Boolean(fieldErrors.ttl)}
                  className="w-32"
                />

                {TTL_PRESETS.map((preset) => (
                  <button
                    key={preset.seconds}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange({ ttl: String(preset.seconds) })}
                    className={cn(
                      "rounded-[var(--radius-button)] border px-3 py-1 text-xs transition-colors",
                      form.ttl === String(preset.seconds)
                        ? "border-primary bg-selected font-bold text-link"
                        : "border-divider text-link hover:bg-hover",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </FormField>
        </>
      )}

      {/* ---- Routing ------------------------------------------------------ */}
      <FormField
        label="Routing policy"
        required
        error={fieldErrors.routing_policy}
        hint={ROUTING_POLICY_INFO[form.routingPolicy].description}
      >
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={form.routingPolicy}
            onChange={(event) =>
              onChange({ routingPolicy: event.target.value as RoutingPolicy })
            }
            disabled={disabled}
            options={ROUTING_POLICIES.map((policy) => ({
              value: policy,
              label: ROUTING_POLICY_INFO[policy].label,
            }))}
          />
        )}
      </FormField>

      {form.routingPolicy !== "simple" && (
        <div className="flex flex-col gap-4 rounded-[var(--radius-input)] border border-subtle bg-page p-4">
          {requires.setIdentifier && (
            <FormField
              label="Record ID"
              required
              error={fieldErrors.set_identifier}
              hint="Distinguishes this record from others sharing its name and type."
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  value={form.setIdentifier}
                  onChange={(event) =>
                    onChange({ setIdentifier: event.target.value })
                  }
                  placeholder="blue"
                  disabled={disabled}
                  invalid={Boolean(fieldErrors.set_identifier)}
                  autoComplete="off"
                />
              )}
            </FormField>
          )}

          {requires.weight && (
            <FormField
              label="Weight"
              required
              error={fieldErrors.weight}
              hint="0–255. Share of traffic is this weight divided by the total across the group."
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="number"
                  min={0}
                  max={255}
                  value={form.weight}
                  onChange={(event) => onChange({ weight: event.target.value })}
                  disabled={disabled}
                  invalid={Boolean(fieldErrors.weight)}
                  className="w-32"
                />
              )}
            </FormField>
          )}

          {requires.region && (
            <FormField label="Region" required error={fieldErrors.region}>
              {(fieldProps) => (
                <Select
                  {...fieldProps}
                  value={form.region}
                  onChange={(event) => onChange({ region: event.target.value })}
                  disabled={disabled}
                  invalid={Boolean(fieldErrors.region)}
                  placeholder="Choose a region"
                  options={AWS_REGIONS.map((region) => ({
                    value: region,
                    label: region,
                  }))}
                />
              )}
            </FormField>
          )}

          {requires.failoverType && (
            <FormField
              label="Failover record type"
              required
              error={fieldErrors.failover_type}
            >
              {(fieldProps) => (
                <Select
                  {...fieldProps}
                  value={form.failoverType}
                  onChange={(event) =>
                    onChange({
                      failoverType: event.target.value as FailoverType,
                    })
                  }
                  disabled={disabled}
                  invalid={Boolean(fieldErrors.failover_type)}
                  placeholder="Choose primary or secondary"
                  options={FAILOVER_OPTIONS}
                />
              )}
            </FormField>
          )}
        </div>
      )}
    </div>
  );
}
