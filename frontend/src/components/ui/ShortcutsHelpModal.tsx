"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { Shortcut } from "@/lib/hooks/useKeyboardShortcuts";
import { cn } from "@/lib/utils/cn";

/**
 * The shortcut list, opened with `?`.
 *
 * Driven by the same array that registers the handlers, so a shortcut cannot
 * exist without being documented, or be documented after it has been removed.
 */
export interface ShortcutsHelpModalProps {
  shortcuts: Shortcut[];
  onClose: () => void;
}

export function ShortcutsHelpModal({
  shortcuts,
  onClose,
}: ShortcutsHelpModalProps) {
  return (
    <Modal
      onClose={onClose}
      title="Keyboard shortcuts"
      size="sm"
      footer={
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <dl className="flex flex-col">
        {shortcuts.map((shortcut) => (
          <div
            key={shortcut.key}
            className="flex items-center justify-between gap-4 border-b border-subtle py-2 last:border-0"
          >
            <dt className="text-sm text-body">{shortcut.description}</dt>
            <dd>
              <kbd
                className={cn(
                  "rounded border border-divider bg-page px-2 py-0.5",
                  "font-mono text-xs text-body shadow-sm",
                )}
              >
                {shortcut.key === " " ? "Space" : shortcut.key}
              </kbd>
            </dd>
          </div>
        ))}

        <div className="flex items-center justify-between gap-4 py-2">
          <dt className="text-sm text-body">Close a dialog</dt>
          <dd>
            <kbd className="rounded border border-divider bg-page px-2 py-0.5 font-mono text-xs text-body shadow-sm">
              Esc
            </kbd>
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-secondary">
        Shortcuts are ignored while you are typing in a field.
      </p>
    </Modal>
  );
}
