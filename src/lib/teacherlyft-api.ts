import "server-only";

import type { ConnectedDevice, DeviceCredential } from "@/lib/device-types";
import { isDeviceCredential } from "@/lib/credential-store";

const REQUEST_TIMEOUT_MS = 10_000;

export class TeacherLyftApiError extends Error {
  constructor(
    readonly kind: "unauthorized" | "invalid_code" | "network" | "malformed" | "configuration",
    message: string,
  ) {
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
    throw new TeacherLyftApiError("network", "TeacherLyft could not be reached");
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { throw new TeacherLyftApiError("malformed", "TeacherLyft returned invalid JSON"); }
}

export async function pairWithTeacherLyft(code: string): Promise<DeviceCredential> {
  const response = await request("/api/devices/pair", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, name: "TeacherLyft Assistant" }),
  });
  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) {
      throw new TeacherLyftApiError("invalid_code", "The pairing code is invalid or expired");
    }
    throw new TeacherLyftApiError("network", "TeacherLyft is unavailable");
  }
  const body = await safeJson(response);
  const value = body as { success?: unknown; deviceId?: unknown; deviceToken?: unknown };
  const credential = { deviceId: value.deviceId, deviceToken: value.deviceToken };
  if (value.success !== true || !isDeviceCredential(credential)) {
    throw new TeacherLyftApiError("malformed", "TeacherLyft returned an invalid pairing response");
  }
  return credential;
}

export async function verifyWithTeacherLyft(credential: DeviceCredential): Promise<ConnectedDevice> {
  const response = await request("/api/device/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${credential.deviceToken}` },
  });
  if (response.status === 401) throw new TeacherLyftApiError("unauthorized", "Device credential was revoked");
  if (!response.ok) throw new TeacherLyftApiError("network", "TeacherLyft is unavailable");
  const body = await safeJson(response);
  const value = body as Partial<ConnectedDevice>;
  if (value.connected !== true || typeof value.deviceId !== "string"
      || typeof value.deviceName !== "string"
      || !(typeof value.teacherDisplayName === "string" || value.teacherDisplayName === null)) {
    throw new TeacherLyftApiError("malformed", "TeacherLyft returned an invalid device response");
  }
  if (value.deviceId !== credential.deviceId) {
    throw new TeacherLyftApiError("malformed", "TeacherLyft returned the wrong device");
  }
  return value as ConnectedDevice;
}
