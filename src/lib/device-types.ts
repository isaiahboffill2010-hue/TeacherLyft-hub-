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
