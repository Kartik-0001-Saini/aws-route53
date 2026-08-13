"use client";

/**
 * Flash notifications — the stacked banners the AWS console shows beneath the
 * breadcrumbs after an action ("Hosted zone example.com was created").
 *
 * Every mutation in the app reports its outcome through here, which is what
 * stops a screen silently claiming success. Success messages dismiss
 * themselves; errors do not, because an error the user missed is an error they
 * will hit again.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type NotificationType = "success" | "error" | "warning" | "info";

export interface Notification {
  id: string;
  type: NotificationType;
  /** Bolded lead-in, as in "Error: could not delete record". */
  header?: string;
  message: string;
  /** Whether the user can dismiss it. Defaults to true. */
  dismissible: boolean;
}

interface NotificationContextValue {
  notifications: Notification[];
  notify: (notification: Omit<Notification, "id" | "dismissible"> & {
    dismissible?: boolean;
  }) => string;
  notifySuccess: (message: string, header?: string) => string;
  notifyError: (message: string, header?: string) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

/** How long a success banner stays before dismissing itself. */
const AUTO_DISMISS_MS = 6000;

/** Cap on the stack, so a burst of failures cannot bury the page. */
const MAX_VISIBLE = 4;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Timers are tracked so a manual dismissal cancels the pending auto-dismiss
  // rather than leaving a callback to fire against a removed id.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const nextId = useRef(0);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setNotifications((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback<NotificationContextValue["notify"]>(
    ({ type, message, header, dismissible = true }) => {
      // A counter, not Math.random() or Date.now(): ids must be stable and
      // collision-free even when several fire in the same tick.
      const id = `notification-${nextId.current++}`;

      setNotifications((current) =>
        [...current, { id, type, message, header, dismissible }].slice(
          -MAX_VISIBLE,
        ),
      );

      if (type === "success") {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
        );
      }

      return id;
    },
    [dismiss],
  );

  const notifySuccess = useCallback(
    (message: string, header?: string) =>
      notify({ type: "success", message, header }),
    [notify],
  );

  const notifyError = useCallback(
    (message: string, header?: string) =>
      notify({ type: "error", message, header }),
    [notify],
  );

  const dismissAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    setNotifications([]);
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      notify,
      notifySuccess,
      notifyError,
      dismiss,
      dismissAll,
    }),
    [notifications, notify, notifySuccess, notifyError, dismiss, dismissAll],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used inside <NotificationProvider>.",
    );
  }
  return context;
}
