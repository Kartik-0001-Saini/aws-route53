"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import {
  useNotifications,
  type NotificationType,
} from "@/lib/notifications/notification-context";
import { cn } from "@/lib/utils/cn";

/**
 * The console's flash message area: full-width banners stacked directly under
 * the breadcrumbs, above the page heading.
 */

const TYPE_STYLES: Record<
  NotificationType,
  { icon: LucideIcon; container: string; icon_: string }
> = {
  success: {
    icon: CheckCircle2,
    container: "bg-success-bg border-success",
    icon_: "text-success",
  },
  error: {
    icon: XCircle,
    container: "bg-error-bg border-error",
    icon_: "text-error",
  },
  warning: {
    icon: AlertTriangle,
    container: "bg-warning-bg border-warning",
    icon_: "text-warning",
  },
  info: {
    icon: Info,
    container: "bg-info-bg border-info",
    icon_: "text-info",
  },
};

export function Flashbar() {
  const { notifications, dismiss } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    // `polite` rather than `assertive`: these announce completed actions, and
    // interrupting a screen-reader user mid-sentence for a success message is
    // more disruptive than useful.
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      {notifications.map((notification) => {
        const style = TYPE_STYLES[notification.type];
        const Icon = style.icon;

        return (
          <div
            key={notification.id}
            className={cn(
              "flex items-start gap-3 rounded-[var(--radius-input)] border px-4 py-3",
              style.container,
            )}
          >
            <Icon
              className={cn("mt-0.5 h-4 w-4 shrink-0", style.icon_)}
              aria-hidden="true"
            />

            <div className="min-w-0 flex-1 text-sm text-body">
              {notification.header && (
                <span className="font-bold">{notification.header}: </span>
              )}
              {/* `break-words` matters: API error messages can contain a long
                  unbroken domain name that would otherwise widen the page. */}
              <span className="break-words">{notification.message}</span>
            </div>

            {notification.dismissible && (
              <button
                type="button"
                onClick={() => dismiss(notification.id)}
                aria-label="Dismiss notification"
                className={cn(
                  "-mr-1 -mt-1 shrink-0 rounded p-1 text-secondary",
                  "hover:bg-hover hover:text-body transition-colors",
                )}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
