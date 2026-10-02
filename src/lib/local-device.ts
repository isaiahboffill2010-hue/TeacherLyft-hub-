import "server-only";

import { deleteDeviceCredential, loadDeviceCredential, saveDeviceCredential } from "@/lib/credential-store";
import type { LocalDeviceState } from "@/lib/device-types";
import { pairWithTeacherLyft, TeacherLyftApiError, verifyWithTeacherLyft } from "@/lib/teacherlyft-api";

let pairingOperation: Promise<LocalDeviceState> | null = null;

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
  await saveDeviceCredential(credential);
  try {
    const device = await verifyWithTeacherLyft(credential);
    return { state: "connected", deviceName: device.deviceName, teacherDisplayName: device.teacherDisplayName };
  } catch (error) {
    await deleteDeviceCredential();
    throw error;
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
