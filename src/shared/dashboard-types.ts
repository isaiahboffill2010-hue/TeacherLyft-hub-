export type DashboardAttentionKind = "grading" | "student" | "class" | "reminder";

export type DashboardAttentionItem = {
  id: string;
  title: string;
  detail: string;
  kind: DashboardAttentionKind;
};

export type DashboardResponse = {
  teacherName: string | null;
  classes: number;
  toGrade: number;
  students: number;
  reminders: number;
  needsAttention: DashboardAttentionItem[];
};

export type DashboardResult =
  | { ok: true; dashboard: DashboardResponse }
  | { ok: false; error: "unavailable" | "unauthorized" | "unpaired" };
