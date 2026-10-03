import "server-only";

import { deleteDeviceCredential, loadDeviceCredential, saveDeviceCredential } from "@/lib/credential-store";
import type { LocalDeviceState } from "@/lib/device-types";
import { pairWithTeacherLyft, TeacherLyftApiError, verifyWithTeacherLyft } from "@/lib/teacherlyft-api";

let pairingOperation: Promise<LocalDeviceState> | null = null;

export class LocalDeviceError extends Error {
  constructor(
    readonly kind: "credential_save" | "pairing_verification",
    message: string,
    readonly causeCode?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LocalDeviceError";
  }
}

function filesystemCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

export async function getLocalDeviceState(): Promise<LocalDeviceState> {
  const credential = await loadDeviceCredential();
  if (!credential) return { state: "unpaired" };
  try {
    const device = await verifyWithTeacherLyft(credential);
    return { state: "connected", deviceName: device.deviceName, teacherDisplayName: device.teacherDisplayName };
  } catch (error) {
    if (error instanceof TeacherLyftApiError && error.kind === "unauthorized") {
      await deleteDeviceCredential();
      return { state: "unpaired", reason: "revoked" };
    }
    return { state: "offline", paired: true };
  }
}

async function performPairing(code: string): Promise<LocalDeviceState> {
  const credential = await pairWithTeacherLyft(code);
  try {
    await saveDeviceCredential(credential);
  } catch (error) {
    throw new LocalDeviceError(
      "credential_save",
      "Unable to save the device credential",
      filesystemCode(error),
      { cause: error },
    );
  }
  try {
    const device = await verifyWithTeacherLyft(credential);
    return { state: "connected", deviceName: device.deviceName, teacherDisplayName: device.teacherDisplayName };
  } catch (error) {
    await deleteDeviceCredential();
    const causeCode = error instanceof TeacherLyftApiError ? error.details.causeCode : undefined;
    throw new LocalDeviceError(
      "pairing_verification",
      "Pairing succeeded but device verification failed",
      causeCode,
      { cause: error },
    );
  }
}

export async function pairLocalDevice(code: string): Promise<LocalDeviceState> {
  if (pairingOperation) return pairingOperation;
  pairingOperation = performPairing(code).finally(() => { pairingOperation = null; });
  return pairingOperation;
}

export async function disconnectLocalDevice(): Promise<void> {
  await deleteDeviceCredential();
}
