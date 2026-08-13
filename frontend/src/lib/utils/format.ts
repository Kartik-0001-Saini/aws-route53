/**
 * Display formatting helpers.
 *
 * All of them tolerate bad input rather than throwing: a formatter that
 * crashes takes the whole table down with it, and a dash in one cell is a far
 * better failure than a blank screen.
 */

/**
 * A timestamp in the console's style: "August 13, 2026, 09:58 (UTC+05:30)".
 *
 * The backend sends UTC-aware ISO strings; this renders them in the viewer's
 * own timezone, with the offset named so there is no ambiguity about which
 * clock a value is in.
 */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "—";

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "shortOffset",
  }).format(date);
}

/** A compact date for dense table cells: "13 Aug 2026". */
export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "—";

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * A TTL as seconds plus a human gloss: "3600 (1 hour)".
 *
 * Route 53 shows the raw number, which is what you edit, but a reader
 * comparing 300 against 172800 benefits from the second form.
 */
export function formatTtl(ttl: number | null | undefined): string {
  if (ttl === null || ttl === undefined) return "—";
  if (ttl === 0) return "0";

  const units: [number, string][] = [
    [86_400, "day"],
    [3_600, "hour"],
    [60, "minute"],
  ];

  for (const [seconds, label] of units) {
    if (ttl >= seconds && ttl % seconds === 0) {
      const count = ttl / seconds;
      return `${ttl} (${count} ${label}${count === 1 ? "" : "s"})`;
    }
  }

  return String(ttl);
}

/** "1 hosted zone" / "5 hosted zones" — pluralisation for counters. */
export function pluralise(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}
