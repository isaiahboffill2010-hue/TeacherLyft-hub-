import type { ConnectedDevice, DeviceCredential } from "@/shared/device-types";
import { isDeviceCredential } from "@/main/credential-store";
import { diagnosticInfo, diagnosticWarn } from "@/main/diagnostic-log";
import type { DashboardAttentionItem, DashboardAttentionKind, DashboardResponse } from "@/shared/dashboard-types";
import type { DetailRequest, HubContent } from "@/shared/content-types";
import type { AssistantRequest, AssistantResult } from "@/shared/assistant-types";

export const REQUEST_TIMEOUTS = {
  authentication: 10_000,
  pairing: 15_000,
  dashboard: 30_000,
  content: 90_000,
  detail: 120_000,
  assistant: 150_000,
} as const;
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

async function request(pathname: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const startedAt = Date.now();
  const isDeviceContent = pathname.startsWith("/api/device/") && pathname !== "/api/device/me";
  const endpoint = pathname
    .replace(/^\/api\/device\/(classes|assignments|curriculum|drafts|library)\/[^/]+/, "/api/device/$1/:id")
    .replace(/\/students\/[^/]+$/, "/students/:id");
  diagnosticInfo("api", isDeviceContent ? "device_content_request_started" : "request_started", { method: init.method ?? "GET", endpoint, configuredTimeoutMs: timeoutMs });
  try {
    const response = await fetch(new URL(pathname, baseUrl()), {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json", ...init.headers },
    });
    diagnosticInfo("api", isDeviceContent ? "device_content_request_completed" : "response_received", { method: init.method ?? "GET", endpoint, status: response.status, durationMs: Date.now() - startedAt, configuredTimeoutMs: timeoutMs });
    return response;
  } catch (error) {
    if (error instanceof TeacherLyftApiError) throw error;
    const code = nestedCode(error);
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError" || code === "UND_ERR_CONNECT_TIMEOUT") {
      diagnosticWarn("api", "request_failed", { endpoint, kind: "timeout", causeCode: code, elapsedMs: Date.now() - startedAt, configuredTimeoutMs: timeoutMs });
      throw new TeacherLyftApiError("timeout", "TeacherLyft request timed out", undefined, code);
    }
    if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "EAI_FAIL") {
      diagnosticWarn("api", "request_failed", { endpoint, kind: "dns", causeCode: code });
      throw new TeacherLyftApiError("dns", "TeacherLyft hostname lookup failed", undefined, code);
    }
    diagnosticWarn("api", "request_failed", { endpoint, kind: "tcp", causeCode: code });
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
  }, REQUEST_TIMEOUTS.pairing);
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
  }, REQUEST_TIMEOUTS.authentication);
  if (INVALID_DEVICE_STATUSES.has(response.status)) {
    diagnosticWarn("device_verification", "authorization_rejected", { status: response.status });
    throw new TeacherLyftApiError("unauthorized", "Device credential is no longer authorized", response.status);
  }
  if (!response.ok) throw new TeacherLyftApiError("http", `Verification returned HTTP ${response.status}`, response.status);
  const value = await safeJson(response) as DeviceVerificationResponse;
  const serverState = typeof value.status === "string" ? value.status.toLowerCase() : "";
  if (value.connected === false || value.revoked === true
      || ["revoked", "disconnected", "disabled", "not_found"].includes(serverState)
      || (typeof value.deviceId === "string" && value.deviceId !== credential.deviceId)) {
    diagnosticWarn("device_verification", "server_reported_invalid_device", {
      connected: value.connected,
      revoked: value.revoked,
      serverState,
      identityMatched: value.deviceId === credential.deviceId,
    });
    throw new TeacherLyftApiError("unauthorized", "Device credential is no longer authorized", response.status);
  }
  if (value.connected !== true || typeof value.deviceId !== "string" || typeof value.deviceName !== "string"
      || !(typeof value.teacherDisplayName === "string" || value.teacherDisplayName === null)) {
    diagnosticWarn("device_verification", "malformed_response", { status: response.status });
    throw new TeacherLyftApiError("malformed", "TeacherLyft returned an invalid device response", response.status);
  }
  diagnosticInfo("device_verification", "authorized");
  return value as ConnectedDevice;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

const ATTENTION_KINDS = new Set<DashboardAttentionKind>(["grading", "student", "class", "reminder"]);

function parseAttentionItem(value: unknown): DashboardAttentionItem | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string"
      || typeof value.detail !== "string" || typeof value.kind !== "string"
      || !ATTENTION_KINDS.has(value.kind as DashboardAttentionKind)) return null;
  return { id: value.id, title: value.title, detail: value.detail, kind: value.kind as DashboardAttentionKind };
}

function parseDashboardResponse(value: unknown): DashboardResponse {
  if (!isRecord(value) || !(typeof value.teacherName === "string" || value.teacherName === null)
      || !isCount(value.classes) || !isCount(value.toGrade) || !isCount(value.students)
      || !isCount(value.reminders) || !Array.isArray(value.needsAttention)) {
    throw new TeacherLyftApiError("malformed", "TeacherLyft returned an invalid dashboard response");
  }
  const needsAttention = value.needsAttention.map(parseAttentionItem);
  if (needsAttention.some((item) => item === null)) {
    throw new TeacherLyftApiError("malformed", "TeacherLyft returned an invalid dashboard response");
  }
  return {
    teacherName: value.teacherName,
    classes: value.classes,
    toGrade: value.toGrade,
    students: value.students,
    reminders: value.reminders,
    needsAttention: needsAttention as DashboardAttentionItem[],
  };
}

export async function fetchTeacherLyftDashboard(credential: DeviceCredential): Promise<DashboardResponse> {
  const response = await request("/api/device/dashboard", {
    method: "GET",
    headers: { Authorization: `Bearer ${credential.deviceToken}` },
  }, REQUEST_TIMEOUTS.dashboard);
  if (INVALID_DEVICE_STATUSES.has(response.status)) {
    throw new TeacherLyftApiError("unauthorized", "Device credential is no longer authorized", response.status);
  }
  if (!response.ok) throw new TeacherLyftApiError("http", `Dashboard returned HTTP ${response.status}`, response.status);
  return parseDashboardResponse(await safeJson(response));
}

const SECTION_PATHS = {
  classes: "/api/device/classes",
  assignments: "/api/device/assignments",
  progress: "/api/device/student-progress",
  curriculum: "/api/device/curriculum",
  drafts: "/api/device/drafts",
  library: "/api/device/library",
} as const;

export async function fetchTeacherLyftContent<K extends keyof HubContent>(
  credential: DeviceCredential,
  section: K,
): Promise<HubContent[K]> {
  const response = await request(SECTION_PATHS[section], {
    method: "GET",
    headers: { Authorization: `Bearer ${credential.deviceToken}` },
  }, REQUEST_TIMEOUTS.content);
  if (INVALID_DEVICE_STATUSES.has(response.status)) {
    throw new TeacherLyftApiError("unauthorized", "Device credential is no longer authorized", response.status);
  }
  if (!response.ok) throw new TeacherLyftApiError("http", `${section} returned HTTP ${response.status}`, response.status);
  const value = await safeJson(response);
  if (!isRecord(value)) throw new TeacherLyftApiError("malformed", `TeacherLyft returned invalid ${section} data`);
  return value as HubContent[K];
}

export async function fetchTeacherLyftDetail(credential: DeviceCredential, detail: DetailRequest): Promise<Record<string, unknown>> {
  const id = encodeURIComponent(detail.id);
  const paths = {
    class: `/api/device/classes/${id}`,
    student: `/api/device/classes/${encodeURIComponent(detail.classId ?? "")}/students/${id}`,
    assignment: `/api/device/assignments/${id}`,
    curriculum: `/api/device/curriculum/${id}`,
    draft: `/api/device/drafts/${id}`,
    library: `/api/device/library/${id}`,
  } as const;
  const response = await request(paths[detail.kind], { method: "GET", headers: { Authorization: `Bearer ${credential.deviceToken}` } }, REQUEST_TIMEOUTS.detail);
  if (response.status === 404) throw new TeacherLyftApiError("http", "Detail not found", 404);
  if (INVALID_DEVICE_STATUSES.has(response.status)) throw new TeacherLyftApiError("unauthorized", "Device credential is no longer authorized", response.status);
  if (!response.ok) throw new TeacherLyftApiError("http", `Detail returned HTTP ${response.status}`, response.status);
  const value = await safeJson(response);
  if (!isRecord(value)) throw new TeacherLyftApiError("malformed", "TeacherLyft returned invalid detail data");
  return value;
}

export async function askTeacherLyftApi(credential: DeviceCredential, input: AssistantRequest): Promise<AssistantResult> {
  const response = await request("/api/device/assistant", {
    method: "POST",
    headers: { Authorization: `Bearer ${credential.deviceToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }, REQUEST_TIMEOUTS.assistant);
  if (INVALID_DEVICE_STATUSES.has(response.status)) return { ok: false, error: "unauthorized", message: "This Hub is no longer authorized." };
  if (!response.ok) return { ok: false, error: response.status === 400 || response.status === 413 ? "invalid_audio" : "unavailable", message: "Couldn't complete that request." };
  const value = await safeJson(response);
  if (!isRecord(value) || typeof value.transcript !== "string" || !value.transcript || typeof value.answer !== "string" || !value.answer
      || !(value.audioBase64 === null || typeof value.audioBase64 === "string") || !(value.audioMimeType === null || value.audioMimeType === "audio/wav")) {
    return { ok: false, error: "unavailable", message: "TeacherLyft returned an invalid assistant response." };
  }
  return { ok: true, transcript: value.transcript, answer: value.answer, audioMimeType: value.audioMimeType, audioBase64: value.audioBase64 };
}
