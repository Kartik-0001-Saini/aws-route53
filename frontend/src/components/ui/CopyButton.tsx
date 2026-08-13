"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Copy-to-clipboard, as the console offers beside zone IDs and name servers.
 *
 * Confirms inline with a tick for a couple of seconds rather than raising a
 * flash message — copying is a small action, and a banner for it would drown
 * out the ones that report real changes.
 */
export interface CopyButtonProps {
  value: string;
  /** Describes what is being copied, for the accessible label. */
  label: string;
  className?: string;
}

const CONFIRMATION_MS = 2000;

export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the pending reset if the component unmounts first, so the timeout
  // cannot fire setState on something that is gone.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
    } catch {
      // The Clipboard API needs a secure context. On plain http (other than
      // localhost) it rejects, and silently doing nothing would look broken.
      setFailed(true);
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCopied(false);
      setFailed(false);
    }, CONFIRMATION_MS);
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={failed ? "Copying needs a secure (https) connection" : undefined}
      className={cn(
        "inline-grid h-6 w-6 shrink-0 place-items-center rounded",
        "text-secondary transition-colors hover:bg-hover hover:text-link",
        failed && "text-error",
        className,
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );
}
