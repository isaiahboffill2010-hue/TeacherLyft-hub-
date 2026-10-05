import { deleteDeviceCredential, loadDeviceCredential, saveDeviceCredential } from "@/main/credential-store";
import { fetchTeacherLyftDashboard, pairWithTeacherLyft, TeacherLyftApiError, verifyWithTeacherLyft } from "@/main/teacherlyft-api";
import type { LocalDeviceState } from "@/shared/device-types";
import type { DashboardResult } from "@/shared/dashboard-types";
import { diagnosticError, diagnosticInfo, diagnosticWarn } from "@/main/diagnostic-log";

let pairingOperation: Promise<LocalDeviceState> | null = null;

export class LocalDeviceError extends Error {
  constructor(readonly kind: "credential_save" | "verification_failed", message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LocalDeviceError";
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
