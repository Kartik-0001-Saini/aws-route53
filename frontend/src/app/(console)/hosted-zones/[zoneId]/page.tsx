"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload } from "lucide-react";

import { DeleteHostedZoneModal } from "@/components/hosted-zones/DeleteHostedZoneModal";
import { EditHostedZoneModal } from "@/components/hosted-zones/EditHostedZoneModal";
import { ExportZoneMenu } from "@/components/hosted-zones/ExportZoneMenu";
import { ImportZoneModal } from "@/components/hosted-zones/ImportZoneModal";
import { RecordsSection } from "@/components/records/RecordsSection";
import { PageLayout } from "@/components/layout/PageLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { CopyButton } from "@/components/ui/CopyButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { KeyValueGrid } from "@/components/ui/KeyValue";
import { ShortcutsHelpModal } from "@/components/ui/ShortcutsHelpModal";
import { Spinner } from "@/components/ui/Spinner";
import { ApiError } from "@/lib/api/client";
import { hostedZonesApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import {
  focusSearchInput,
  useKeyboardShortcuts,
  type Shortcut,
} from "@/lib/hooks/useKeyboardShortcuts";
import { formatDateTime } from "@/lib/utils/format";

const BASE_CRUMBS = [
  { label: "Route 53", href: "/dashboard" },
  { label: "Hosted zones", href: "/hosted-zones" },
];

export default function HostedZoneDetailPage() {
  // `useParams` rather than the `params` prop: this is a client component, and
  // in the App Router `params` arrives as a promise that would have to be
  // unwrapped with `use()` before it could be read.
  const { zoneId } = useParams<{ zoneId: string }>();
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const shortcuts: Shortcut[] = useMemo(
    () => [
      {
        key: "/",
        description: "Search records",
        handler: () => focusSearchInput("Search records"),
      },
      {
        key: "i",
        description: "Import records from a zone file",
        handler: () => setImportOpen(true),
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

  const { data: zone, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.zones.detail(zoneId),
    queryFn: ({ signal }) => hostedZonesApi.get(zoneId, signal),
  });

  if (isPending) {
    return (
      <PageLayout title="Hosted zone" breadcrumbs={BASE_CRUMBS}>
        <div className="grid place-items-center py-24">
          <Spinner size="lg" className="text-primary" label="Loading zone" />
        </div>
      </PageLayout>
    );
  }

  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;

    return (
      <PageLayout title="Hosted zone" breadcrumbs={BASE_CRUMBS}>
        <Container>
          <div className="py-12">
            <EmptyState
              title={notFound ? "Hosted zone not found" : "Could not load hosted zone"}
              description={
                notFound
                  ? `No hosted zone with the ID ${zoneId} exists in this account. It may have been deleted.`
                  : error instanceof ApiError
                    ? error.message
                    : "Something went wrong."
              }
              action={
                notFound ? (
                  <Button
                    variant="primary"
                    onClick={() => router.push("/hosted-zones")}
                  >
                    Back to hosted zones
                  </Button>
                ) : (
                  <Button variant="normal" onClick={() => void refetch()}>
                    Try again
                  </Button>
                )
              }
            />
          </div>
        </Container>
      </PageLayout>
    );
  }

  const isPublic = zone.type === "public";

  const details = [
    {
      label: "Hosted zone ID",
      value: (
        <span className="flex items-center gap-1">
          <span className="font-mono text-xs">{zone.zone_id}</span>
          <CopyButton value={zone.zone_id} label="hosted zone ID" />
        </span>
      ),
    },
    {
      label: "Type",
      value: (
        <Badge variant={isPublic ? "blue" : "neutral"}>
          {isPublic ? "Public" : "Private"}
        </Badge>
      ),
    },
    { label: "Record count", value: zone.record_count },
    { label: "Description", value: zone.comment || "—" },
    { label: "Created", value: formatDateTime(zone.created_at) },
    { label: "Last modified", value: formatDateTime(zone.updated_at) },
    ...(isPublic
      ? []
      : [
          { label: "VPC ID", value: zone.vpc_id || "—" },
          { label: "VPC region", value: zone.vpc_region || "—" },
        ]),
  ];

  return (
    <PageLayout
      breadcrumbs={[...BASE_CRUMBS, { label: zone.name }]}
      title={zone.name}
      // Zone-level actions only. Creating a record belongs to the records
      // container below, where the console puts it too — two "Create record"
      // buttons on one page would be a coin toss as to which one is live.
      actions={
        <>
          <ExportZoneMenu zone={zone} />
          <Button
            variant="normal"
            onClick={() => setImportOpen(true)}
            iconLeft={<Upload className="h-3.5 w-3.5" />}
          >
            Import
          </Button>

          {/* "Edit hosted zone", not "Edit": the records container below has
              its own Edit button, and two identically labelled buttons on one
              screen is a coin toss as to which resource is affected. */}
          <Button variant="normal" onClick={() => setEditOpen(true)}>
            Edit hosted zone
          </Button>
          <Button variant="normal" onClick={() => setDeleteOpen(true)}>
            Delete zone
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Container title="Hosted zone details">
          <KeyValueGrid items={details} columns={3} />
        </Container>

        {isPublic && (
          <Container
            title="Hosted zone name servers"
            description="Add these name servers to your domain registrar so queries for this domain reach Route 53."
            actions={
              <CopyButton
                value={zone.name_servers.join("\n")}
                label="all name servers"
              />
            }
          >
            <ul className="flex flex-col gap-1">
              {zone.name_servers.map((nameServer) => (
                <li
                  key={nameServer}
                  className="flex items-center gap-1 font-mono text-xs text-body"
                >
                  {nameServer}
                  <CopyButton value={nameServer} label={nameServer} />
                </li>
              ))}
            </ul>
          </Container>
        )}

        <RecordsSection zone={zone} />
      </div>

      {editOpen && (
        <EditHostedZoneModal zone={zone} onClose={() => setEditOpen(false)} />
      )}
      {deleteOpen && (
        <DeleteHostedZoneModal
          zone={zone}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => router.push("/hosted-zones")}
        />
      )}
      {importOpen && (
        <ImportZoneModal zone={zone} onClose={() => setImportOpen(false)} />
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
