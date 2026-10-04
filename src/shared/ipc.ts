export const IPC_CHANNELS = {
  getDeviceState: "teacherlyft:get-device-state",
  pair: "teacherlyft:pair",
  retryConnection: "teacherlyft:retry-connection",
  localDisconnect: "teacherlyft:local-disconnect",
} as const;

export function isValidPairRequest(value: unknown): value is { code: string } {
  return Boolean(value && typeof value === "object" && "code" in value
    && typeof value.code === "string" && /^\d{6}$/.test(value.code));
}
