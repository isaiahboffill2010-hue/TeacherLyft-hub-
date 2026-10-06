export const IPC_CHANNELS = {
  getDeviceState: "teacherlyft:get-device-state",
  getDashboard: "teacherlyft:get-dashboard",
  getClasses: "teacherlyft:get-classes",
  getAssignments: "teacherlyft:get-assignments",
  getStudentProgress: "teacherlyft:get-student-progress",
  getCurriculum: "teacherlyft:get-curriculum",
  getDrafts: "teacherlyft:get-drafts",
  getLibrary: "teacherlyft:get-library",
  getDetail: "teacherlyft:get-detail",
  askTeacherLyft: "teacherlyft:ask-teacherlyft",
  pair: "teacherlyft:pair",
  retryConnection: "teacherlyft:retry-connection",
  localDisconnect: "teacherlyft:local-disconnect",
} as const;

export { isAssistantRequest } from "@/shared/assistant-types";

export function isValidPairRequest(value: unknown): value is { code: string } {
  return Boolean(value && typeof value === "object" && "code" in value
    && typeof value.code === "string" && /^\d{6}$/.test(value.code));
}

export function isValidDetailRequest(value: unknown): value is import("@/shared/content-types").DetailRequest {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const kinds = new Set(["class", "student", "assignment", "curriculum", "draft", "library"]);
  return typeof item.kind === "string" && kinds.has(item.kind) && typeof item.id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(item.id)
    && (item.kind !== "student" || typeof item.classId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(item.classId));
}
