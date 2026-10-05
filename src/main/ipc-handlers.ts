import type { IpcMainInvokeEvent } from "electron";
import { ipcMain } from "electron";
import { disconnectLocalDevice, getLocalDashboard, getLocalDeviceState, LocalDeviceError, pairLocalDevice } from "@/main/local-device";
import { TeacherLyftApiError } from "@/main/teacherlyft-api";
import { IPC_CHANNELS, isValidPairRequest } from "@/shared/ipc";
import type { DeviceActionResult } from "@/shared/device-types";
import { diagnosticInfo, diagnosticWarn } from "@/main/diagnostic-log";

function requireTrustedSender(event: IpcMainInvokeEvent, webContentsId: number): void {
  const senderUrl = event.senderFrame?.url;
  if (event.sender.id !== webContentsId || event.senderFrame !== event.sender.mainFrame
      || !senderUrl || !isTrustedRendererUrl(senderUrl)) {
    diagnosticWarn("ipc", "sender_rejected", {
      senderMatched: event.sender.id === webContentsId,
      mainFrame: event.senderFrame === event.sender.mainFrame,
      urlPresent: Boolean(senderUrl),
    });
    throw new Error("Rejected untrusted IPC sender");
  }
}

export function isTrustedRendererUrl(url: string): boolean {
  if (url.startsWith("file://")) return true;
  const developmentUrl = process.env.ELECTRON_RENDERER_URL;
  return Boolean(developmentUrl && new URL(url).origin === new URL(developmentUrl).origin);
}

function safePairFailure(error: unknown): DeviceActionResult {
  const diagnostic = error instanceof TeacherLyftApiError
    ? { kind: error.kind, status: error.status, causeCode: error.causeCode }
    : error instanceof LocalDeviceError
      ? { kind: error.kind, causeKind: error.cause instanceof TeacherLyftApiError ? error.cause.kind : undefined }
      : { kind: "unexpected" };
  console.error("[electron/pair] Pairing failed", diagnostic);

  if (error instanceof TeacherLyftApiError && error.kind === "invalid_code") {
    return { ok: false, error: "invalid_code", message: "That pairing code is invalid or has expired." };
  }
  if (error instanceof TeacherLyftApiError && error.kind === "malformed") {
    return { ok: false, error: "invalid_response", message: "TeacherLyft could not complete pairing. Please try again." };
  }
  if (error instanceof LocalDeviceError && error.kind === "credential_save") {
    return { ok: false, error: "credential_save", message: "This device could not save its connection. Please contact support." };
  }
  if (error instanceof LocalDeviceError && error.kind === "verification_failed") {
    return { ok: false, error: "verification_failed", message: "Pairing completed, but verification failed. Please try again." };
  }
  return { ok: false, error: "unavailable", message: "Unable to reach TeacherLyft. Check your internet connection." };
}

export function registerIpcHandlers(webContentsId: number): void {
  diagnosticInfo("ipc", "handlers_registered", { webContentsId });
  ipcMain.handle(IPC_CHANNELS.getDeviceState, async (event) => {
    requireTrustedSender(event, webContentsId);
    diagnosticInfo("ipc", "get_device_state_invoked");
    return getLocalDeviceState();
  });
  ipcMain.handle(IPC_CHANNELS.getDashboard, async (event) => {
    requireTrustedSender(event, webContentsId);
    diagnosticInfo("ipc", "get_dashboard_invoked");
    return getLocalDashboard();
  });
  ipcMain.handle(IPC_CHANNELS.retryConnection, async (event) => {
    requireTrustedSender(event, webContentsId);
    diagnosticInfo("ipc", "retry_connection_invoked");
    return getLocalDeviceState();
  });
  ipcMain.handle(IPC_CHANNELS.localDisconnect, async (event) => {
    requireTrustedSender(event, webContentsId);
    diagnosticInfo("ipc", "local_disconnect_invoked");
    await disconnectLocalDevice();
    return { state: "unpaired" } as const;
  });
  ipcMain.handle(IPC_CHANNELS.pair, async (event, request: unknown): Promise<DeviceActionResult> => {
    requireTrustedSender(event, webContentsId);
    diagnosticInfo("ipc", "pair_invoked");
    if (!isValidPairRequest(request)) {
      diagnosticWarn("ipc", "pair_request_invalid");
      return { ok: false, error: "invalid_code", message: "Enter all six digits before connecting." };
    }
    try { return { ok: true, state: await pairLocalDevice(request.code) }; }
    catch (error) { return safePairFailure(error); }
  });
}

export function removeIpcHandlers(): void {
  for (const channel of Object.values(IPC_CHANNELS)) ipcMain.removeHandler(channel);
}
