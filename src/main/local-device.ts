import { deleteDeviceCredential, loadDeviceCredential, saveDeviceCredential } from "@/main/credential-store";
import { pairWithTeacherLyft, TeacherLyftApiError, verifyWithTeacherLyft } from "@/main/teacherlyft-api";
import type { LocalDeviceState } from "@/shared/device-types";

let pairingOperation: Promise<LocalDeviceState> | null = null;

export class LocalDeviceError extends Error {
  constructor(readonly kind: "credential_save" | "verification_failed", message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LocalDeviceError";
  }
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
    throw new LocalDeviceError("credential_save", "Unable to save the device credential", { cause: error });
  }
  try {
    const device = await verifyWithTeacherLyft(credential);
    return { state: "connected", deviceName: device.deviceName, teacherDisplayName: device.teacherDisplayName };
  } catch (error) {
    if (error instanceof TeacherLyftApiError
        && (error.kind === "dns" || error.kind === "tcp" || error.kind === "timeout" || error.kind === "http")) {
      return { state: "offline", paired: true };
    }
    await deleteDeviceCredential();
    throw new LocalDeviceError("verification_failed", "Pairing succeeded but verification failed", { cause: error });
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
