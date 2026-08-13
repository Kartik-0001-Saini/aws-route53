"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { ApiError } from "@/lib/api/client";
import { hostedZonesApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { useNotifications } from "@/lib/notifications/notification-context";
import { pluralise } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { HostedZoneDetail, ImportResult } from "@/types/api";

/**
 * Import records from a BIND zone file.
 *
 * Two steps, always: parse and preview, then apply. Importing DNS is a
 * destructive-adjacent operation on live infrastructure, and a single button
 * that reads a file and writes records gives nobody a chance to notice that
 * half the file was unparseable before it lands.
 */

const MAX_FILE_BYTES = 1_048_576;

export interface ImportZoneModalProps {
  zone: HostedZoneDetail;
  onClose: () => void;
}

export function ImportZoneModal({ zone, onClose }: ImportZoneModalProps) {
  const queryClient = useQueryClient();
  const { notifySuccess, notifyError } = useNotifications();

  const [content, setContent] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runImport = useMutation({
    mutationFn: (apply: boolean) =>
      hostedZonesApi.import(zone.zone_id, {
        content,
        apply,
        overwrite_existing: overwrite,
      }),

    onSuccess: (result) => {
      setPreview(result);
      setError(null);

      if (!result.applied) return;

      void queryClient.invalidateQueries({ queryKey: queryKeys.zones.all });

      const changed = result.created + result.updated;
      if (changed === 0) {
        notifyError(
          "Nothing was imported. Check the conflicts and skipped lines below.",
          "No changes",
        );
        return;
      }

      notifySuccess(
        `${pluralise(result.created, "record")} created and ${result.updated} updated in ${zone.name}.`,
        "Import complete",
      );
      onClose();
    },

    onError: (caught) => {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not read the zone file.",
      );
    },
  });

  const handleFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is larger than 1 MB. Zone files are usually a few kilobytes.");
      return;
    }

    setError(null);
    setContent(await file.text());
    setPreview(null);
  };

  // Any edit invalidates the preview — showing counts computed from text the
  // user has since changed is worse than showing none.
  const handleContentChange = (value: string) => {
    setContent(value);
    setPreview(null);
  };

  const hasContent = content.trim().length > 0;
  const canApply =
    preview !== null && !preview.applied && preview.created + preview.updated > 0;

  return (
    <Modal
      onClose={onClose}
      title="Import records"
      description={`Paste or upload a BIND zone file to add records to ${zone.name}.`}
      dismissDisabled={runImport.isPending}
      footer={
        <>
          <Button variant="link" onClick={onClose} disabled={runImport.isPending}>
            Cancel
          </Button>
          <Button
            variant="normal"
            onClick={() => runImport.mutate(false)}
            loading={runImport.isPending && !runImport.variables}
            disabled={!hasContent || runImport.isPending}
          >
            Preview
          </Button>
          <Button
            variant="primary"
            onClick={() => runImport.mutate(true)}
            loading={runImport.isPending && runImport.variables === true}
            disabled={!canApply || runImport.isPending}
          >
            Import
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="rounded-[var(--radius-input)] border border-error bg-error-bg px-3 py-2 text-sm text-body"
          >
            {error}
          </div>
        )}

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zone,.txt,.db,text/plain"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              // Reset, so choosing the same file twice fires change again.
              event.target.value = "";
            }}
          />
          <Button
            variant="normal"
            onClick={() => fileInputRef.current?.click()}
            iconLeft={<Upload className="h-3.5 w-3.5" />}
          >
            Choose a zone file
          </Button>
        </div>

        <FormField
          label="Zone file"
          required
          hint="$ORIGIN, $TTL, @ and blank owner names are all understood. $INCLUDE and $GENERATE are not."
        >
          {(fieldProps) => (
            <Textarea
              {...fieldProps}
              mono
              rows={10}
              value={content}
              onChange={(event) => handleContentChange(event.target.value)}
              placeholder={"$ORIGIN example.com.\n$TTL 300\n@\tIN\tA\t192.0.2.1\nwww\tIN\tCNAME\t@"}
              spellCheck={false}
            />
          )}
        </FormField>

        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="import-overwrite"
            checked={overwrite}
            onChange={(event) => {
              setOverwrite(event.target.checked);
              setPreview(null);
            }}
            aria-describedby="import-overwrite-description"
            className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-[var(--color-primary)]"
          />
          <div>
            <label
              htmlFor="import-overwrite"
              className="cursor-pointer select-none text-sm font-bold text-label"
            >
              Overwrite existing records
            </label>
            <p id="import-overwrite-description" className="text-sm text-secondary">
              Replace record sets that already exist. Off by default — existing
              records are reported as conflicts and left alone.
            </p>
          </div>
        </div>

        {preview && <ImportPreview result={preview} />}
      </div>
    </Modal>
  );
}

/** What the import will do, or did. */
function ImportPreview({ result }: { result: ImportResult }) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-input)] border border-subtle bg-page p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-heading">
          {result.applied ? "Import result" : "Preview"}
        </span>
        <Badge variant="green">{result.created} to create</Badge>
        <Badge variant="blue">{result.updated} to update</Badge>
        {result.conflicts.length > 0 && (
          <Badge variant="amber">{result.conflicts.length} conflicts</Badge>
        )}
        {(result.skipped.length > 0 || result.rejected.length > 0) && (
          <Badge variant="red">
            {result.skipped.length + result.rejected.length} problems
          </Badge>
        )}
      </div>

      {result.records.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded border border-subtle bg-container">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-container-header">
              <tr className="border-b border-subtle text-left">
                <th className="px-2 py-1.5 font-bold text-heading">Name</th>
                <th className="px-2 py-1.5 font-bold text-heading">Type</th>
                <th className="px-2 py-1.5 font-bold text-heading">TTL</th>
                <th className="px-2 py-1.5 font-bold text-heading">Value</th>
              </tr>
            </thead>
            <tbody>
              {result.records.map((record) => (
                <tr
                  key={`${record.name}-${record.type}`}
                  className="border-b border-subtle last:border-0"
                >
                  <td className="px-2 py-1 font-mono text-body">{record.name}</td>
                  <td className="px-2 py-1">
                    <Badge>{record.type}</Badge>
                  </td>
                  <td className="px-2 py-1 text-secondary">{record.ttl ?? "—"}</td>
                  <td className="px-2 py-1 font-mono text-secondary break-words">
                    {record.values.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.conflicts.length > 0 && (
        <ProblemList
          tone="warning"
          title={`${pluralise(result.conflicts.length, "record")} already exist and will be left alone`}
          items={result.conflicts.map(
            (record) => `${record.name} ${record.type}`,
          )}
          hint="Tick “Overwrite existing records” to replace them instead."
        />
      )}

      {result.skipped.length > 0 && (
        <ProblemList
          tone="error"
          title={`${pluralise(result.skipped.length, "line")} could not be read`}
          items={result.skipped}
        />
      )}

      {result.rejected.length > 0 && (
        <ProblemList
          tone="error"
          title={`${pluralise(result.rejected.length, "record")} failed validation`}
          items={result.rejected}
        />
      )}
    </div>
  );
}

function ProblemList({
  tone,
  title,
  items,
  hint,
}: {
  tone: "warning" | "error";
  title: string;
  items: string[];
  hint?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-input)] border px-3 py-2",
        tone === "warning"
          ? "border-warning bg-warning-bg"
          : "border-error bg-error-bg",
      )}
    >
      <p className="flex items-center gap-1.5 text-sm font-bold text-body">
        <AlertTriangle
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            tone === "warning" ? "text-warning" : "text-error",
          )}
          aria-hidden="true"
        />
        {title}
      </p>

      <ul className="mt-1 max-h-28 overflow-y-auto">
        {items.map((item) => (
          <li key={item} className="font-mono text-xs text-secondary">
            {item}
          </li>
        ))}
      </ul>

      {hint && <p className="mt-1 text-xs text-secondary">{hint}</p>}
    </div>
  );
}
