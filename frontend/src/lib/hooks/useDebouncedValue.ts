"use client";

import { useEffect, useState } from "react";

/**
 * Delays a value until it has stopped changing for `delayMs`.
 *
 * Used by the search boxes: without it, every keystroke would fire a request,
 * and the responses could arrive out of order and render the wrong result set
 * for what is currently typed.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
