import { requireApiKey } from "./config.js";

const API_BASE_URL = "https://api.parallel.ai/v1";
const REQUEST_TIMEOUT_MS = 120_000;

export interface ParallelWarning {
  type: string;
  message: string;
  detail?: Record<string, unknown> | null;
}

export interface ParallelUsageItem {
  name: string;
  count: number;
}

export interface ParallelResultItem {
  url: string;
  title?: string | null;
  publish_date?: string | null;
  excerpts: string[];
}

export interface SearchResponse {
  search_id: string;
  session_id: string;
  results: ParallelResultItem[];
  warnings?: ParallelWarning[] | null;
  usage?: ParallelUsageItem[] | null;
}

export interface ExtractResultItem extends ParallelResultItem {
  full_content?: string | null;
}

export interface ExtractError {
  url: string;
  error_type: string;
  http_status_code?: number | null;
  content?: string | null;
}

export interface ExtractResponse {
  extract_id: string;
  session_id: string;
  results: ExtractResultItem[];
  errors: ExtractError[];
  warnings?: ParallelWarning[] | null;
  usage?: ParallelUsageItem[] | null;
}

export class ParallelApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly referenceId?: string,
  ) {
    super(message);
    this.name = "ParallelApiError";
  }
}

export async function parallelRequest<T>(
  path: "/search" | "/extract",
  body: Record<string, unknown>,
  signal?: AbortSignal,
  configuredApiKey?: string,
): Promise<T> {
  const apiKey = configuredApiKey ?? await requireApiKey();
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: requestSignal,
    });
  } catch (error) {
    if (signal?.aborted) throw new Error("Parallel API request was cancelled.");
    if (timeoutSignal.aborted) throw new Error("Parallel API request timed out after 120 seconds.");
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not reach the Parallel API: ${message}`);
  }

  const raw = await response.text();
  let payload: unknown;
  try {
    payload = raw ? JSON.parse(raw) : undefined;
  } catch {
    if (response.ok) {
      throw new ParallelApiError("Parallel API returned an invalid JSON response.", response.status);
    }
  }

  if (!response.ok) {
    throw createApiError(response.status, payload, raw);
  }

  if (!payload || typeof payload !== "object") {
    throw new ParallelApiError("Parallel API returned an empty response.", response.status);
  }

  return payload as T;
}

function createApiError(status: number, payload: unknown, raw: string): ParallelApiError {
  const error = getRecord(getRecord(payload)?.error);
  const referenceId = typeof error?.ref_id === "string" ? error.ref_id : undefined;
  const apiMessage = typeof error?.message === "string" ? error.message.slice(0, 500) : undefined;

  if (status === 401 || status === 403) {
    return new ParallelApiError(
      "The configured Parallel API key was rejected. Ask the user to run /parallel-setup and paste a valid API key.",
      status,
      referenceId,
    );
  }

  if (status === 429) {
    return new ParallelApiError("Parallel API rate limit exceeded. Wait and try again.", status, referenceId);
  }

  const fallback = raw.trim().slice(0, 500);
  const message = apiMessage || fallback || `Parallel API request failed with HTTP ${status}.`;
  const suffix = referenceId ? ` (reference: ${referenceId})` : "";
  return new ParallelApiError(`${message}${suffix}`, status, referenceId);
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
