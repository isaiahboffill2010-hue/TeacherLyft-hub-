export type DeviceCredential = {
  deviceId: string;
  deviceToken: string;
};

export type ConnectedDevice = {
  connected: true;
  deviceId: string;
  deviceName: string;
  teacherDisplayName: string | null;
};

export type LocalDeviceState =
  | { state: "unpaired"; reason?: "revoked" }
  | { state: "connected"; deviceName: string; teacherDisplayName: string | null }
  | { state: "offline"; paired: true };

export type PairRequest = { code: string };

export type SafeActionError =
  | "invalid_code"
  | "unavailable"
  | "invalid_response"
  | "credential_save"
  | "verification_failed"
  | "unexpected";

export type DeviceActionResult =
  | { ok: true; state: LocalDeviceState }
  | { ok: false; error: SafeActionError; message: string };

export interface TeacherLyftBridge {
  getDeviceState(): Promise<LocalDeviceState>;
  pair(request: PairRequest): Promise<DeviceActionResult>;
  retryConnection(): Promise<LocalDeviceState>;
  localDisconnect(): Promise<LocalDeviceState>;
}
