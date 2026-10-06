import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "@/renderer/components/BottomNav";
import { AssignmentsPage, ClassesPage, CurriculumPage, DraftsPage, LibraryPage, MorePage, ProgressPage, SettingsPage } from "@/renderer/components/ContentPages";

describe("TeacherLyft page structure in the Hub shell", () => {
  it("keeps exactly the five Hub bottom tabs with no Assistant or sidebar", () => {
    const html = renderToStaticMarkup(createElement(BottomNav, { active: "home", onChange: vi.fn() }));
    for (const label of ["Home", "Classes", "Assignments", "Progress", "More"]) expect(html).toContain(label);
    expect(html.match(/<button/g)).toHaveLength(5);
    expect(html).not.toContain("Assistant");
    expect(html).toContain('class="bottom-nav"');
    for (const path of ["../src/renderer/components/HubDashboard.tsx", "../src/renderer/components/BottomNav.tsx", "../src/renderer/components/ContentPages.tsx"]) expect(readFileSync(new URL(path, import.meta.url), "utf8")).not.toContain("hub-sidebar");
  });

  it("exposes secondary pages only through More", () => {
    const nav = renderToStaticMarkup(createElement(BottomNav, { active: "more", onChange: vi.fn() }));
    for (const label of ["Curriculum", "Drafts", "Library", "Settings"]) expect(nav).not.toContain(`>${label}<`);
    const more = renderToStaticMarkup(createElement(MorePage, { onOpen: vi.fn() }));
    for (const label of ["Curriculum", "Drafts", "Library", "Settings"]) expect(more).toContain(label);
  });

  it("matches the TeacherLyft Classes hierarchy and terminology", () => {
    const html = renderToStaticMarkup(createElement(ClassesPage, { loading: false, error: false, items: [{ id: "c1", name: "Biology", section: "Period 2", period: null, studentCount: 1, students: [{ id: "s1", name: "Morgan" }] }] }));
    expectOrdered(html, ["Classes", "The classes you teach in Google Classroom", "Your classes", "1 active class", "Biology", "Students", "1 on the roster"]);
    expect(html).not.toContain("need attention");
    const empty = renderToStaticMarkup(createElement(ClassesPage, { items: [], loading: false, error: false }));
    expect(empty).toContain("No classes yet"); expect(empty).toContain("There is nothing to import");
  });

  it("matches grouped TeacherLyft Assignments instead of Hub-only tabs", () => {
    const html = renderToStaticMarkup(createElement(AssignmentsPage, { loading: false, error: false, items: [{ id: "a1", classId: "c1", className: "Biology", title: "Cells", dueDate: "2026-10-10", status: "PUBLISHED", submissionCount: 4, gradedCount: 2, toGradeCount: 2, averagePercentage: 80, type: "Google Classroom" }] }));
    expectOrdered(html, ["Assignments", "Everything you have assigned in Google Classroom, grouped by class.", "Search by assignment title", "Sort", "Biology", "1 assignment", "Total", "Submissions", "Avg AI grade", "Awaiting grade", "Cells", "Google Classroom", "PUBLISHED"]);
    for (const invented of ["Needs Review", "Upcoming", "Completed"]) expect(html).not.toContain(invented);
  });

  it("matches the Student Progress overview hierarchy", () => {
    const html = renderToStaticMarkup(createElement(ProgressPage, { loading: false, error: false, classes: [{ id: "c1", class_name: "Math", student_count: 20, avg_grade: 82, assignments_given: 3, graded_count: 8, awaiting_grade_count: 1, missing_count: 2, on_track_count: 14, needs_attention_count: 3, at_risk_count: 1, no_evidence_count: 0, completion_rate: 90, students: [{ id: "s1", name: "Jordan" }] }] }));
    expectOrdered(html, ["Student Progress", "Performance, completion and follow-up", "Students", "Needing Attention", "Missing Work", "Recent Performance", "Classes", "Math", "Class average", "Turned in", "3 assignments", "2 missing", "4 need attention"]);
    expect(html).toContain('aria-label="Across all classes"');
  });

  it("matches Curriculum, Drafts, and Solution Library organization", () => {
    const curriculum = renderToStaticMarkup(createElement(CurriculumPage, { loading: false, error: false, items: [{ id: "t1", title: "Algebra", publisher: "Open Press", subject: "Math", courseLevel: "Grade 8", status: "ready", pageCount: 100, processedPages: 100, totalPages: 100, structureStatus: "ready" }] }));
    expectOrdered(curriculum, ["My Curriculum", "Upload and organize", "Add Textbook", "Algebra", "Math", "Ready", "Pages", "Processed", "Structure", "Open on web", "Delete on web"]);
    const drafts = renderToStaticMarkup(createElement(DraftsPage, { loading: false, error: false, items: [{ id: "d1", classId: "c1", className: "Math", title: "Fractions", dueDate: null, maxPoints: 20, updatedAt: null, status: "DRAFT" }] }));
    expectOrdered(drafts, ["Drafts", "have no answer key yet", "1 to set up", "Fractions", "Math", "no due date", "20 points", "Not published in Classroom", "Classroom", "Set up"]);
    const library = renderToStaticMarkup(createElement(LibraryPage, { loading: false, error: false, items: [{ id: "l1", subject: "Math", concept_name: "Fractions", description: "Equivalent fractions", solution_summaries: { teaching_method: "Visual models" } }] }));
    expectOrdered(library, ["Teacher Resource Library", "Solution Library", "Method Match", "New Concept", "Math", "Fractions", "Equivalent fractions", "Summary Ready", "Resources", "Upload on web"]);
  });

  it("keeps TeacherLyft Settings wording/order and separates Hub-only settings", () => {
    const html = renderToStaticMarkup(createElement(SettingsPage, { connection: "connected", onDisconnect: vi.fn() }));
    expectOrdered(html, ["Settings", "Manage your connections", "School", "Google Workspace", "Devices", "Appearance", "Hub device settings", "Disconnect this device"]);
  });

  it("uses a white touch shell with a fixed five-column bottom navigation", () => {
    const css = readFileSync(new URL("../src/renderer/styles.css", import.meta.url), "utf8");
    expect(css).toMatch(/body,.hub-shell\s*\{\s*background:#fff/);
    expect(css).toMatch(/\.bottom-nav\s*\{[^}]*position:\s*fixed/s);
    expect(css).toMatch(/grid-template-columns:\s*repeat\(5,1fr\)/);
    expect(css).toContain("min-height:3rem");
  });
});

function expectOrdered(text: string, values: string[]) {
  let position = -1;
  for (const value of values) { const next = text.indexOf(value, position + 1); expect(next, `expected ${value} after offset ${position}`).toBeGreaterThan(position); position = next; }
}
