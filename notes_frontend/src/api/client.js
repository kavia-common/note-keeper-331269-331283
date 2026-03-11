const DEFAULT_TIMEOUT_MS = 20000;

/**
 * @typedef {Object} ApiError
 * @property {string} message Human-friendly error message
 * @property {number|undefined} status HTTP status code if available
 * @property {any} details Parsed response body (if any)
 * @property {string} operation Operation name for debugging
 */

/**
 * Builds a stable error object with context for debugging.
 * @param {string} operation
 * @param {string} message
 * @param {number|undefined} status
 * @param {any} details
 * @returns {ApiError}
 */
function makeApiError(operation, message, status, details) {
  return { operation, message, status, details };
}

/**
 * Reads base URL once at the boundary.
 * Prefer REACT_APP_API_BASE_URL; fallback to localhost dev backend.
 */
function getApiBaseUrl() {
  return (process.env.REACT_APP_API_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
}

/**
 * Best-effort parse: JSON if content-type indicates, else text.
 * @param {Response} res
 */
async function parseResponseBody(res) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  try {
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Creates an AbortSignal that combines a timeout with an optional external signal.
 * @param {AbortSignal|undefined} signal
 * @param {number} timeoutMs
 */
function makeAbortSignal(signal, timeoutMs) {
  if (typeof AbortSignal !== "undefined" && AbortSignal.any) {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  }

  // Fallback for environments without AbortSignal.any/timeout.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Request timeout")), timeoutMs);
  if (signal) {
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        controller.abort(signal.reason);
      },
      { once: true }
    );
  }
  return controller.signal;
}

// PUBLIC_INTERFACE
export async function apiRequest(operation, path, options = {}) {
  /**
   * Public contract:
   * Inputs:
   * - operation: stable string for observability (e.g., "notes.list")
   * - path: string beginning with "/" (relative to base URL)
   * - options: { method, query, body, headers, signal, timeoutMs }
   *
   * Outputs:
   * - { ok: true, data, status } on success
   * - { ok: false, error } on failure, never throws (except programmer errors)
   *
   * Errors:
   * - Network error
   * - Timeout/abort
   * - Non-2xx HTTP responses (status + parsed details)
   *
   * Side effects:
   * - Performs a network request to backend REST API.
   */
  const baseUrl = getApiBaseUrl();
  const method = (options.method || "GET").toUpperCase();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!path.startsWith("/")) {
    return { ok: false, error: makeApiError(operation, `Invalid path "${path}" (must start with "/")`) };
  }

  const query = options.query || {};
  const qs = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    qs.set(k, String(v));
  });

  const url = `${baseUrl}${path}${qs.toString() ? `?${qs.toString()}` : ""}`;

  /** @type {RequestInit} */
  const init = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  init.signal = makeAbortSignal(options.signal, timeoutMs);

  try {
    const res = await fetch(url, init);
    const body = await parseResponseBody(res);

    if (!res.ok) {
      const msg =
        (body && typeof body === "object" && (body.message || body.error)) ||
        (typeof body === "string" && body) ||
        `Request failed (${res.status})`;

      return { ok: false, error: makeApiError(operation, msg, res.status, body) };
    }

    return { ok: true, data: body, status: res.status };
  } catch (e) {
    // AbortError is common for both manual abort and timeout.
    const message = e && typeof e === "object" && "name" in e && e.name === "AbortError" ? "Request aborted" : "Network error";
    return { ok: false, error: makeApiError(operation, message, undefined, String(e)) };
  }
}
