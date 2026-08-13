"use client";

import { ChevronDown, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api/client";
import { hostedZonesApi } from "@/lib/api/endpoints";
import { useNotifications } from "@/lib/notifications/notification-context";
import { cn } from "@/lib/utils/cn";
import type { HostedZoneDetail } from "@/types/api";

/**
 * Export a hosted zone as a BIND zone file or as JSON.
 *
 * A menu rather than two buttons: the zone header already carries three
 * actions, and BIND-versus-JSON is a format choice within one action rather
 * than two different things a user might want to do.
 */
export function ExportZoneMenu({ zone }: { zone: HostedZoneDetail }) {
  const { notifySuccess, notifyError } = useNotifications();
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState<"bind" | "json" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleExport = async (format: "bind" | "json") => {
    setOpen(false);
    setDownloading(format);

    try {
      await hostedZonesApi.export(zone.zone_id, zone.name, format);
      notifySuccess(
        `${zone.name} was exported as ${format === "bind" ? "a BIND zone file" : "JSON"}.`,
        "Success",
      );
    } catch (error) {
      // A failed download is invisible otherwise — the browser simply does
      // nothing, which reads as a broken button.
      notifyError(
        error instanceof ApiError
          ? error.message
          : "Could not export the hosted zone.",
        "Error",
      );
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="normal"
        onClick={() => setOpen((current) => !current)}
        loading={downloading !== null}
        aria-expanded={open}
        aria-haspopup="menu"
        iconLeft={<Download className="h-3.5 w-3.5" />}
        iconRight={<ChevronDown className="h-3 w-3" />}
      >
        Export
      </Button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-9 z-20 w-64 overflow-hidden",
            "rounded-[var(--radius-input)] border border-divider bg-container",
            "py-1 shadow-[var(--shadow-dropdown)]",
          )}
        >
          <MenuItem
            label="BIND zone file"
            description="Standard DNS format, readable by any name server."
            onClick={() => void handleExport("bind")}
          />
          <MenuItem
            label="JSON"
            description="The zone and its records, including routing policies."
            onClick={() => void handleExport("json")}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="block w-full px-4 py-2 text-left hover:bg-hover"
    >
      <span className="block text-sm text-body">{label}</span>
      <span className="block text-xs text-secondary">{description}</span>
    </button>
  );
}
