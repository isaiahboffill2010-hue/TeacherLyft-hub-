import type { ConnectedDevice, DeviceCredential } from "@/shared/device-types";
import { isDeviceCredential } from "@/main/credential-store";

const REQUEST_TIMEOUT_MS = 10_000;
const INVALID_DEVICE_STATUSES = new Set([400, 401, 403, 404, 410, 422]);
type DeviceVerificationResponse = {
  connected?: unknown;
  deviceId?: unknown;
  deviceName?: unknown;
  teacherDisplayName?: unknown;
  revoked?: unknown;
  status?: unknown;
};
export type ApiErrorKind = "configuration" | "dns" | "tcp" | "timeout" | "http" | "unauthorized" | "invalid_code" | "malformed";

export class TeacherLyftApiError extends Error {
  constructor(readonly kind: ApiErrorKind, message: string, readonly status?: number, readonly causeCode?: string) {
    super(message);
    this.name = "TeacherLyftApiError";
  }
}

function baseUrl(): URL {
  const configured = process.env.TEACHERLYFT_API_URL?.trim();
  if (!configured) throw new TeacherLyftApiError("configuration", "TEACHERLYFT_API_URL is not configured");
  let parsed: URL;
  try { parsed = new URL(configured); } catch { throw new TeacherLyftApiError("configuration", "TEACHERLYFT_API_URL is invalid"); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new TeacherLyftApiError("configuration", "TEACHERLYFT_API_URL must be an HTTP(S) origin without credentials");
  }
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed;
}

function nestedCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string") return candidate.code;
    current = candidate.cause;
  }
  return undefined;
}

async function request(pathname: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(new URL(pathname, baseUrl()), {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { Accept: "application/json", ...init.headers },
    });
  } catch (error) {
    if (error instanceof TeacherLyftApiError) throw error;
    const code = nestedCode(error);
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError" || code === "UND_ERR_CONNECT_TIMEOUT") {
      throw new TeacherLyftApiError("timeout", "TeacherLyft request timed out", undefined, code);
    }
    if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "EAI_FAIL") {
      throw new TeacherLyftApiError("dns", "TeacherLyft hostname lookup failed", undefined, code);
    }
    throw new TeacherLyftApiError("tcp", "TeacherLyft connection failed", undefined, code);
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try { return await response.json(); }
  catch { throw new TeacherLyftApiError("malformed", "TeacherLyft returned invalid JSON", response.status); }
}

export async function pairWithTeacherLyft(code: string): Promise<DeviceCredential> {
  const response = await request("/api/devices/pair", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, name: "TeacherLyft Assistant" }),
  });
  if (response.status === 400) throw new TeacherLyftApiError("invalid_code", "The pairing code is invalid or expired", 400);
  if (!response.ok) throw new TeacherLyftApiError("http", `Pairing returned HTTP ${response.status}`, response.status);
  const body = await safeJson(response) as { success?: unknown; deviceId?: unknown; deviceToken?: unknown };
  const credential = { deviceId: body.deviceId, deviceToken: body.deviceToken };
  if (body.success !== true || !isDeviceCredential(credential)) {
    throw new TeacherLyftApiError("malformed", "TeacherLyft returned an invalid pairing response", response.status);
  }
  return credential;
}

export async function verifyWithTeacherLyft(credential: DeviceCredential): Promise<ConnectedDevice> {
  const response = await request("/api/device/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${credential.deviceToken}` },
  });
  if (INVALID_DEVICE_STATUSES.has(response.status)) {
    throw new TeacherLyftApiError("unauthorized", "Device credential is no longer authorized", response.status);
  }
  if (!response.ok) throw new TeacherLyftApiError("http", `Verification returned HTTP ${response.status}`, response.status);
  const value = await safeJson(response) as DeviceVerificationResponse;
  const serverState = typeof value.status === "string" ? value.status.toLowerCase() : "";
  if (value.connected === false || value.revoked === true
      || ["revoked", "disconnected", "disabled", "not_found"].includes(serverState)
      || (typeof value.deviceId === "string" && value.deviceId !== credential.deviceId)) {
    throw new TeacherLyftApiError("unauthorized", "Device credential is no longer authorized", response.status);
  }
  if (value.connected !== true || typeof value.deviceId !== "string" || typeof value.deviceName !== "string"
      || !(typeof value.teacherDisplayName === "string" || value.teacherDisplayName === null)) {
    throw new TeacherLyftApiError("malformed", "TeacherLyft returned an invalid device response", response.status);
  }
  return value as ConnectedDevice;
}
