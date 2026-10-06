import { deleteDeviceCredential, loadDeviceCredential, saveDeviceCredential } from "@/main/credential-store";
import { askTeacherLyftApi, fetchTeacherLyftContent, fetchTeacherLyftDashboard, fetchTeacherLyftDetail, pairWithTeacherLyft, TeacherLyftApiError, verifyWithTeacherLyft } from "@/main/teacherlyft-api";
import type { ContentResult, HubContent } from "@/shared/content-types";
import type { DetailRequest, DetailResult } from "@/shared/content-types";
import type { LocalDeviceState } from "@/shared/device-types";
import type { DashboardResult } from "@/shared/dashboard-types";
import { diagnosticError, diagnosticInfo, diagnosticWarn } from "@/main/diagnostic-log";
import type { AssistantRequest, AssistantResult } from "@/shared/assistant-types";

let pairingOperation: Promise<LocalDeviceState> | null = null;

export async function askLocalTeacherLyft(input: AssistantRequest): Promise<AssistantResult> {
  const credential = await loadDeviceCredential();
  if (!credential) return { ok: false, error: "unpaired", message: "Pair this Hub before using the assistant." };
  try { return await askTeacherLyftApi(credential, input); }
  catch (error) {
    const kind = error instanceof TeacherLyftApiError ? error.kind : "unexpected";
    diagnosticWarn("assistant", "request_failed", { kind, status: error instanceof TeacherLyftApiError ? error.status : undefined });
    const offline = kind === "dns" || kind === "tcp" || kind === "timeout";
    return { ok: false, error: kind === "unauthorized" ? "unauthorized" : offline ? "offline" : "unavailable", message: offline ? "TeacherLyft Assistant requires an internet connection." : "Couldn't complete that request." };
  }
}

export class LocalDeviceError extends Error {
  constructor(readonly kind: "credential_save" | "verification_failed", message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LocalDeviceError";
  }
}

export async function getLocalDetail(detail: DetailRequest): Promise<DetailResult> {
  const credential = await loadDeviceCredential();
  if (!credential) return { ok: false, error: "unpaired" };
  try { return { ok: true, data: await fetchTeacherLyftDetail(credential, detail) }; }
  catch (error) {
    const kind = error instanceof TeacherLyftApiError ? error.kind : "unexpected";
    const status = error instanceof TeacherLyftApiError ? error.status : undefined;
    diagnosticWarn("detail", "fetch_failed", { detailKind: detail.kind, kind, status });
    if (status === 404) return { ok: false, error: "not_found" };
    return { ok: false, error: kind === "unauthorized" ? "unauthorized" : "unavailable" };
  }
}

export async function getLocalDeviceState(): Promise<LocalDeviceState> {
  diagnosticInfo("device_state", "credential_lookup_started");
  const credential = await loadDeviceCredential();
  if (!credential) {
    diagnosticInfo("device_state", "credential_not_found", { nextState: "unpaired" });
    return { state: "unpaired" };
  }
  diagnosticInfo("device_state", "credential_found");
  try {
    diagnosticInfo("device_state", "verification_started");
    const device = await verifyWithTeacherLyft(credential);
    diagnosticInfo("device_state", "verification_succeeded", { nextState: "connected" });
    return { state: "connected", deviceName: device.deviceName, teacherDisplayName: device.teacherDisplayName };
  } catch (error) {
    const metadata = error instanceof TeacherLyftApiError
      ? { kind: error.kind, status: error.status, causeCode: error.causeCode }
      : { kind: "unexpected" };
    if (error instanceof TeacherLyftApiError && error.kind === "unauthorized") {
      diagnosticWarn("device_state", "credential_rejected", metadata);
      await deleteDeviceCredential();
      diagnosticInfo("device_state", "credential_cleared", { nextState: "unpaired" });
      return { state: "unpaired", reason: "revoked" };
    }
    diagnosticWarn("device_state", "verification_unavailable", { ...metadata, nextState: "offline" });
    return { state: "offline", paired: true };
  }
}

async function performPairing(code: string): Promise<LocalDeviceState> {
  diagnosticInfo("pairing", "request_started", { codeLength: code.length });
  const credential = await pairWithTeacherLyft(code);
  diagnosticInfo("pairing", "server_accepted");
  try {
    await saveDeviceCredential(credential);
    diagnosticInfo("pairing", "credential_saved");
  } catch (error) {
    diagnosticError("pairing", "credential_save_failed", { kind: "credential_save" });
    throw new LocalDeviceError("credential_save", "Unable to save the device credential", { cause: error });
  }
  try {
    const device = await verifyWithTeacherLyft(credential);
    diagnosticInfo("pairing", "verification_succeeded", { nextState: "connected" });
    return { state: "connected", deviceName: device.deviceName, teacherDisplayName: device.teacherDisplayName };
  } catch (error) {
    if (error instanceof TeacherLyftApiError
        && (error.kind === "dns" || error.kind === "tcp" || error.kind === "timeout" || error.kind === "http")) {
      diagnosticWarn("pairing", "verification_unavailable", { kind: error.kind, status: error.status, nextState: "offline" });
      return { state: "offline", paired: true };
    }
    diagnosticWarn("pairing", "verification_failed", {
      kind: error instanceof TeacherLyftApiError ? error.kind : "unexpected",
      status: error instanceof TeacherLyftApiError ? error.status : undefined,
    });
    await deleteDeviceCredential();
    diagnosticInfo("pairing", "credential_cleared");
    throw new LocalDeviceError("verification_failed", "Pairing succeeded but verification failed", { cause: error });
  }
}

export async function pairLocalDevice(code: string): Promise<LocalDeviceState> {
  if (pairingOperation) return pairingOperation;
  pairingOperation = performPairing(code).finally(() => { pairingOperation = null; });
  return pairingOperation;
}

export async function disconnectLocalDevice(): Promise<void> {
  diagnosticInfo("device_state", "local_disconnect_started");
  await deleteDeviceCredential();
  diagnosticInfo("device_state", "local_disconnect_completed", { nextState: "unpaired" });
}

export async function getLocalDashboard(): Promise<DashboardResult> {
  const credential = await loadDeviceCredential();
  if (!credential) return { ok: false, error: "unpaired" };
  try {
    return { ok: true, dashboard: await fetchTeacherLyftDashboard(credential) };
  } catch (error) {
    const kind = error instanceof TeacherLyftApiError ? error.kind : "unexpected";
    diagnosticWarn("dashboard", "fetch_failed", {
      kind,
      status: error instanceof TeacherLyftApiError ? error.status : undefined,
    });
    return { ok: false, error: kind === "unauthorized" ? "unauthorized" : "unavailable" };
  }
}

export async function getLocalContent<K extends keyof HubContent>(section: K): Promise<ContentResult<K>> {
  const credential = await loadDeviceCredential();
  if (!credential) return { ok: false, error: "unpaired" };
  try {
    return { ok: true, data: await fetchTeacherLyftContent(credential, section) };
  } catch (error) {
    const kind = error instanceof TeacherLyftApiError ? error.kind : "unexpected";
    diagnosticWarn("content", "fetch_failed", { section, kind, status: error instanceof TeacherLyftApiError ? error.status : undefined });
    return { ok: false, error: kind === "unauthorized" ? "unauthorized" : "unavailable" };
  }
}
