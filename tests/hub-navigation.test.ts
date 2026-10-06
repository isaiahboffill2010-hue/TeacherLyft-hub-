import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "@/renderer/components/BottomNav";
import { ClassesPage, AssignmentsPage, MorePage, ProgressPage, SimpleCardsPage } from "@/renderer/components/ContentPages";

describe("touch companion navigation and data states", () => {
  it("has exactly the five Hub bottom tabs and no Assistant navigation item", () => {
    const html = renderToStaticMarkup(createElement(BottomNav, { active: "home", onChange: vi.fn() }));
    for (const label of ["Home", "Classes", "Assignments", "Progress", "More"]) expect(html).toContain(label);
    for (const label of ["Curriculum", "Drafts", "Library", "Settings"]) expect(html).not.toContain(`>${label}<`);
    expect(html.match(/<button/g)).toHaveLength(5);
    expect(html).not.toContain(">Assistant<");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('class="bottom-nav"');
  });

  it("marks the active bottom tab and exposes secondary tools through More", () => {
    const nav = renderToStaticMarkup(createElement(BottomNav, { active: "more", onChange: vi.fn() }));
    expect(nav).toMatch(/class="active" aria-current="page"[^>]*>.*More/s);
    const more = renderToStaticMarkup(createElement(MorePage, { onOpen: vi.fn() }));
    for (const label of ["Curriculum", "Drafts", "Library", "Settings"]) expect(more).toContain(label);
  });

  it("renders real class data and class selection controls", () => {
    const html = renderToStaticMarkup(createElement(ClassesPage, { loading: false, error: false, items: [{ id: "c1", name: "Biology", section: "Period 2", period: "Period 2", studentCount: 1, students: [{ id: "s1", name: "Morgan" }] }] }));
    expect(html).toContain("Biology"); expect(html).toContain("1 students"); expect(html).toContain("<button");
  });

  it("supports assignment filters and real review counts", () => {
    const html = renderToStaticMarkup(createElement(AssignmentsPage, { loading: false, error: false, items: [{ id: "a1", classId: "c1", className: "Biology", title: "Cells", dueDate: "2026-10-10", status: "active", submissionCount: 4, gradedCount: 2, toGradeCount: 2, averagePercentage: 80, type: "Google Classroom" }] }));
    expect(html).toContain("Needs Review"); expect(html).toContain("Cells"); expect(html).toContain("2 to grade");
  });

  it("renders progress and safe empty/error/unavailable states", () => {
    const progress = renderToStaticMarkup(createElement(ProgressPage, { loading: false, error: false, classes: [{ id: "c1", class_name: "Math", student_count: 20, avg_grade: 82, assignments_given: 3, graded_count: 8, awaiting_grade_count: 1, missing_count: 2, on_track_count: 14, needs_attention_count: 4, at_risk_count: 2, no_evidence_count: 0, completion_rate: 90, students: [{ id: "s1", name: "Jordan" }] }] }));
    expect(progress).toContain("Math"); expect(progress).toContain("82% average");
    expect(renderToStaticMarkup(createElement(ClassesPage, { items: [], loading: false, error: false }))).toContain("Nothing to show yet");
    expect(renderToStaticMarkup(createElement(ClassesPage, { items: [], loading: false, error: true }))).toContain("unavailable");
    expect(renderToStaticMarkup(createElement(SimpleCardsPage, { title: "Curriculum", subtitle: "Books", items: [], loading: false, error: false, unavailable: true }))).toContain("not available");
  });

  it("does not render or define a permanent sidebar", () => {
    const source = readFileSync(new URL("../src/renderer/components/HubDashboard.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("hub-sidebar");
    expect(source).toContain("<BottomNav");
  });
});
