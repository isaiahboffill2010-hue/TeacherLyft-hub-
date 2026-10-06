export const IPC_CHANNELS = {
  getDeviceState: "teacherlyft:get-device-state",
  getDashboard: "teacherlyft:get-dashboard",
  getClasses: "teacherlyft:get-classes",
  getAssignments: "teacherlyft:get-assignments",
  getStudentProgress: "teacherlyft:get-student-progress",
  getCurriculum: "teacherlyft:get-curriculum",
  getDrafts: "teacherlyft:get-drafts",
  getLibrary: "teacherlyft:get-library",
  pair: "teacherlyft:pair",
  retryConnection: "teacherlyft:retry-connection",
  localDisconnect: "teacherlyft:local-disconnect",
} as const;

export function isValidPairRequest(value: unknown): value is { code: string } {
  return Boolean(value && typeof value === "object" && "code" in value
    && typeof value.code === "string" && /^\d{6}$/.test(value.code));
}
