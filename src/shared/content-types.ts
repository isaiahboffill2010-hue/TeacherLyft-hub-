export type HubClass = { id: string; name: string; section: string | null; period: string | null; studentCount: number; students: Array<{ id: string; name: string }> };
export type HubAssignment = { id: string; classId: string; className: string; title: string; dueDate: string | null; status: string; submissionCount: number; gradedCount: number; toGradeCount: number; averagePercentage: number | null; type: string };
export type HubProgressClass = { id: string; class_name: string; student_count: number; avg_grade: number | null; assignments_given: number; graded_count: number; awaiting_grade_count: number; missing_count: number; on_track_count: number; needs_attention_count: number; at_risk_count: number; no_evidence_count: number; completion_rate: number | null; students: Array<{ id: string; name: string }> };
export type HubDraft = { id: string; classId: string; className: string; title: string; dueDate: string | null; maxPoints: number | null; updatedAt: string | null; status: string | null };
export type HubTextbook = { id: string; title: string | null; publisher: string | null; subject: string | null; courseLevel: string | null; status: string; pageCount: number | null; processedPages: number | null; totalPages: number | null; structureStatus: string };
export type HubConcept = { id: string; subject: string | null; concept_name: string; description: string | null; solution_summaries?: unknown };

export type HubContent = {
  classes: { classes: HubClass[] };
  assignments: { assignments: HubAssignment[]; countsArePartial: boolean };
  progress: { totals: Record<string, number | null>; classes: HubProgressClass[] };
  curriculum: { available: boolean; reason?: string; textbooks: HubTextbook[] };
  drafts: { drafts: HubDraft[] };
  library: { concepts: HubConcept[] };
};

export type ContentResult<K extends keyof HubContent> =
  | { ok: true; data: HubContent[K] }
  | { ok: false; error: "unavailable" | "unauthorized" | "unpaired" };

export type DetailKind = "class" | "student" | "assignment" | "curriculum" | "draft" | "library";
export type DetailRequest = { kind: DetailKind; id: string; classId?: string };
export type DetailResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: "unavailable" | "unauthorized" | "unpaired" | "not_found" };
