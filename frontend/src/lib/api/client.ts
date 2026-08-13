/**
 * The HTTP client every API call goes through.
 *
 * Responsibilities, and nothing else:
 *   - attach a fresh Bearer token
 *   - build query strings, including repeated params for multi-select filters
 *   - turn the backend's error envelope into a typed `ApiError`
 *   - never let a failed request resolve as if it succeeded
 */

import type { ApiErrorBody } from "@/types/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8000";

const API_PREFIX = "/api/v1";

/**
 * A failed API call, carrying enough structure for a form to display
 * field-level errors instead of a generic banner.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  /** The session is gone or was never valid — the caller should sign out. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /** A uniqueness or state conflict the user can act on. */
  get isConflict(): boolean {
    return this.status === 409;
  }
}

/**
 * Supplies the current auth token.
 *
 * Registered by the auth provider rather than read from storage directly, so
 * the Firebase SDK stays the single source of truth for token freshness — it
 * refreshes an expiring token transparently, which reading a cached string
 * from `localStorage` would not.
 */
type TokenProvider = () => Promise<string | null>;

let tokenProvider: TokenProvider = async () => null;

export function setTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

/** Query values the API accepts. Arrays become repeated params. */
export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number)[];

function buildQueryString(query?: Record<string, QueryValue>): string {
  if (!query) return "";

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;

    if (Array.isArray(value)) {
      // FastAPI reads repeated keys as a list — `?type=A&type=TXT`.
      for (const entry of value) params.append(key, String(entry));
    } else {
      params.append(key, String(value));
    }
  }

  const serialised = params.toString();
  return serialised ? `?${serialised}` : "";
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // A non-JSON failure — a proxy 502, or the backend not running at all.
    // Fall through to the generic message below rather than masking it.
  }

  if (body?.error) {
    return new ApiError(
      response.status,
      body.error.code,
      body.error.message,
      body.error.details?.fields ?? {},
    );
  }

  return new ApiError(
    response.status,
    "NetworkError",
    response.status >= 500
      ? "The server could not complete the request. Try again."
      : `Request failed with status ${response.status}.`,
  );
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  /** Skip the Authorization header — only the pre-login endpoints do this. */
  anonymous?: boolean;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query, signal, anonymous = false } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (!anonymous) {
    const token = await tokenProvider();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${API_PREFIX}${path}${buildQueryString(query)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    // The request never reached the server: backend down, CORS rejected, or
    // the host still cold-starting. Say so plainly instead of surfacing a bare
    // "Failed to fetch".
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      0,
      "NetworkError",
      "Could not reach the server. Check that the backend is running.",
    );
  }

  if (!response.ok) throw await toApiError(response);

  // 204 and other empty responses have no body to parse.
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * Fetch a file from the API and hand it to the browser as a download.
 *
 * A plain `<a href>` cannot be used: the export endpoints require an
 * `Authorization` header, and a link carries no headers. So the body is
 * fetched, turned into an object URL, and clicked programmatically.
 *
 * The filename comes from `Content-Disposition` when present, so the server
 * stays in charge of naming and the caller only supplies a fallback.
 */
export async function downloadFile(
  path: string,
  fallbackFilename: string,
  query?: Record<string, QueryValue>,
): Promise<void> {
  const token = await tokenProvider();
  const url = `${API_BASE_URL}${API_PREFIX}${path}${buildQueryString(query)}`;

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) throw await toApiError(response);

  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? fallbackFilename;

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Releasing immediately can cancel the download in some browsers; a tick is
  // enough for the navigation to have been picked up.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/** Liveness check, also used to warm a sleeping host before the first call. */
export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { signal });
    return response.ok;
  } catch {
    return false;
  }
}

export { API_BASE_URL };
