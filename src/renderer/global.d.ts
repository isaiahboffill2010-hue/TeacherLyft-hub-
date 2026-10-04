import type { TeacherLyftBridge } from "@/shared/device-types";

declare global {
  interface Window {
    teacherlyft: TeacherLyftBridge;
  }
}

export {};
