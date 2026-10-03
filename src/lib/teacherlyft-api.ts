import "server-only";

import type { ConnectedDevice, DeviceCredential } from "@/lib/device-types";
import { isDeviceCredential } from "@/lib/credential-store";

const REQUEST_TIMEOUT_MS = 10_000;

export type TeacherLyftApiErrorKind =
  | "configuration_missing"
  | "configuration_malformed"
  | "configuration_rejected"
  | "dns"
  | "tcp"
  | "timeout"
  | "http"
  | "unauthorized"
  | "invalid_code"
  | "malformed_json"
  | "malformed_response";

export class TeacherLyftApiError extends Error {
  constructor(
    readonly kind: TeacherLyftApiErrorKind,
    message: string,
    readonly details: { operation?: string; status?: number; causeCode?: string } = {},
  ) {
    super(message);
    this.name = "TeacherLyftApiError";
  }
}

export function baseUrl(): URL {
  const configured = process.env.TEACHERLYFT_API_URL?.trim();
  if (!configured) throw new TeacherLyftApiError("configuration_missing", "TEACHERLYFT_API_URL is not configured");
  let parsed: URL;
  try { parsed = new URL(configured); } catch { throw new TeacherLyftApiError("configuration_malformed", "TEACHERLYFT_API_URL is invalid"); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new TeacherLyftApiError("configuration_rejected", "TEACHERLYFT_API_URL must be an HTTP(S) origin without credentials");
  }
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed;
}

function errorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string") return candidate.code;
    current = candidate.cause;
  }
  return undefined;
}

function networkError(error: unknown, operation: string): TeacherLyftApiError {
  const code = errorCode(error);
  const name = error instanceof Error ? error.name : undefined;
  if (name === "TimeoutError" || name === "AbortError" || code === "UND_ERR_CONNECT_TIMEOUT") {
    return new TeacherLyftApiError("timeout", "TeacherLyft request timed out", { operation, causeCode: code });
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "EAI_FAIL") {
    return new TeacherLyftApiError("dns", "TeacherLyft hostname lookup failed", { operation, causeCode: code });
  }
  return new TeacherLyftApiError("tcp", "TeacherLyft connection failed", { operation, causeCode: code });
}

async function request(pathname: string, init: RequestInit, operation: string): Promise<Response> {
  try {
    return await fetch(new URL(pathname, baseUrl()), {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json", ...init.headers },
    });
  } catch (error) {
    if (error instanceof TeacherLyftApiError) throw error;
    throw networkError(error, operation);
  }
}

async function safeJson(response: Response, operation: string): Promise<unknown> {
  try { return await response.json(); } catch {
    throw new TeacherLyftApiError("malformed_json", "TeacherLyft returned invalid JSON", {
      operation,
      status: response.status,
    });
  }
}

export async function pairWithTeacherLyft(code: string): Promise<DeviceCredential> {
  const response = await request("/api/devices/pair", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, name: "TeacherLyft Assistant" }),
  }, "pair");
  if (!response.ok) {
    if (response.status === 400) {
      throw new TeacherLyftApiError("invalid_code", "The pairing code is invalid or expired", {
        operation: "pair",
        status: response.status,
      });
    }
    throw new TeacherLyftApiError("http", `TeacherLyft pairing returned HTTP ${response.status}`, {
      operation: "pair",
      status: response.status,
    });
  }
  const body = await safeJson(response, "pair");
  const value = body as { success?: unknown; deviceId?: unknown; deviceToken?: unknown };
  const credential = { deviceId: value.deviceId, deviceToken: value.deviceToken };
  if (value.success !== true || !isDeviceCredential(credential)) {
    throw new TeacherLyftApiError("malformed_response", "TeacherLyft returned an invalid pairing response", {
      operation: "pair",
      status: response.status,
    });
  }
  return credential;
}

export async function verifyWithTeacherLyft(credential: DeviceCredential): Promise<ConnectedDevice> {
  const response = await request("/api/device/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${credential.deviceToken}` },
  }, "verify");
  if (response.status === 401) {
    throw new TeacherLyftApiError("unauthorized", "Device credential was rejected", {
      operation: "verify",
      status: response.status,
    });
  }
  if (!response.ok) {
    throw new TeacherLyftApiError("http", `TeacherLyft verification returned HTTP ${response.status}`, {
      operation: "verify",
      status: response.status,
    });
  }
  const body = await safeJson(response, "verify");
  const value = body as Partial<ConnectedDevice>;
  if (value.connected !== true || typeof value.deviceId !== "string"
      || typeof value.deviceName !== "string"
      || !(typeof value.teacherDisplayName === "string" || value.teacherDisplayName === null)) {
    throw new TeacherLyftApiError("malformed_response", "TeacherLyft returned an invalid device response", {
      operation: "verify",
      status: response.status,
    });
  }
  if (value.deviceId !== credential.deviceId) {
    throw new TeacherLyftApiError("malformed_response", "TeacherLyft returned the wrong device", {
      operation: "verify",
      status: response.status,
    });
  }
  return value as ConnectedDevice;
}

export async function probeTeacherLyft(): Promise<{
  host: string | null;
  protocol: string | null;
  fetchSucceeded: boolean;
  status: number | null;
  latencyMs: number;
}> {
  const started = performance.now();
  let configured: URL;
  try {
    configured = baseUrl();
  } catch (error) {
    const kind = error instanceof TeacherLyftApiError ? error.kind : "unexpected";
    console.error("[local/debug-backend] Backend configuration check failed", { kind });
    return { host: null, protocol: null, fetchSucceeded: false, status: null, latencyMs: Math.round(performance.now() - started) };
  }
  try {
    const response = await request("/", { method: "GET" }, "debug_probe");
    return {
      host: configured.host,
      protocol: configured.protocol.replace(":", ""),
      fetchSucceeded: true,
      status: response.status,
      latencyMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    const diagnostic = error instanceof TeacherLyftApiError
      ? { kind: error.kind, ...error.details }
      : { kind: "unexpected" };
    console.error("[local/debug-backend] Backend fetch failed", diagnostic);
    return {
      host: configured.host,
      protocol: configured.protocol.replace(":", ""),
      fetchSucceeded: false,
      status: null,
      latencyMs: Math.round(performance.now() - started),
    };
  }
}
