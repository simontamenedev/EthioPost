import { useAuthStore } from "../auth/auth-store";
import { LOGIN_PATH } from "../auth/constants";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: object;
  /** JSON body */
  json?: unknown;
  /** application/x-www-form-urlencoded body (used by /auth/login) */
  form?: Record<string, string>;
  /** multipart/form-data body (file uploads). Content-Type is set by the browser. */
  formData?: FormData;
  /** set false for public endpoints (no Bearer header, no auto-logout on 401) */
  auth?: boolean;
  signal?: AbortSignal;
  /** how to parse a successful response body (default "json") */
  responseType?: "json" | "blob";
};

function buildUrl(path: string, query?: object): string {
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function toApiError(res: Response): Promise<ApiError> {
  let detail: unknown;
  try {
    detail = (await res.json())?.detail;
  } catch {
    /* body was not JSON */
  }
  if (typeof detail === "string") return new ApiError(res.status, detail);
  if (Array.isArray(detail)) {
    // FastAPI validation errors: [{ loc: ["body", "name"], msg: "..." }]
    const message = detail
      .map((d: { loc?: (string | number)[]; msg?: string }) => `${(d.loc ?? []).slice(1).join(".")}: ${d.msg ?? "invalid"}`)
      .join("; ");
    return new ApiError(res.status, message || "Validation failed");
  }
  return new ApiError(res.status, res.statusText || "Request failed");
}

/** Shared fetch: builds headers/body, sends the Bearer token, handles 401 and non-2xx. */
async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = "GET", query, json, form, formData, auth = true, signal, responseType = "json" } = options;

  const headers: Record<string, string> = {
    Accept: responseType === "blob" ? "*/*" : "application/json",
  };
  if (auth) {
    const token = useAuthStore.getState().token;
    if (token) headers.Authorization = `Bearer ${token}`; // <- token sent as Bearer on every call
  }

  let body: BodyInit | undefined;
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(form).toString();
  } else if (formData) {
    // Do NOT set Content-Type: the browser adds multipart/form-data with the boundary.
    body = formData;
  } else if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), { method, headers, body, signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }

  if (res.status === 401 && auth) {
    // Token missing/expired/revoked → drop the session and go to login.
    useAuthStore.getState().logout();
    if (typeof window !== "undefined" && window.location.pathname !== LOGIN_PATH) {
      window.location.assign(LOGIN_PATH);
    }
  }
  if (!res.ok) throw await toApiError(res);
  return res;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await request(path, options);
  if (res.status === 204) return undefined as T;
  if (options.responseType === "blob") return (await res.blob()) as T;
  return (await res.json()) as T;
}

/** Authenticated file download: returns the blob plus the filename from Content-Disposition. */
export async function apiDownload(
  path: string,
  options: Omit<RequestOptions, "responseType"> = {},
  fallbackName = "download",
): Promise<{ blob: Blob; filename: string }> {
  const res = await request(path, { ...options, responseType: "blob" });
  const filename =
    /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  return { blob: await res.blob(), filename: decodeURIComponent(filename) };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}