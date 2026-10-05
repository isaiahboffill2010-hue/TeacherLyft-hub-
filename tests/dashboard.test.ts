import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeDashboard } from "@/renderer/components/HomeDashboard";
import { HubDashboard } from "@/renderer/components/HubDashboard";
import type { DashboardResponse } from "@/shared/dashboard-types";

const dashboard: DashboardResponse = {
  teacherName: "Dr. Okafor",
  classes: 6,
  toGrade: 14,
  students: 132,
  reminders: 3,
  needsAttention: [{ id: "grade-1", title: "14 papers to grade", detail: "Algebra quiz - Period 3", kind: "grading" }],
};

const oldMockText = [
  "Active classes this term",
  "Assignments waiting",
  "Total students",
  "Upcoming items",
  "Algebra quiz needs review",
  "3 students missing Assignment 4",
  "Period 2 average dropped 6%",
];
const oldMockStatValues = ["value: 5", "value: 12", "value: 128", "value: 4"];

function expectNoPhase3AMocks(html: string) {
  for (const value of [5, 12, 128, 4]) expect(html).not.toContain(`<strong>${value}</strong>`);
  for (const text of oldMockText) expect(html).not.toContain(text);
}

function renderHome(overrides: Partial<Parameters<typeof HomeDashboard>[0]> = {}) {
  return renderToStaticMarkup(createElement(HomeDashboard, {
    dashboard,
    loading: false,
    teacherName: dashboard.teacherName ?? "Teacher",
    unavailable: false,
    ...overrides,
  }));
}

describe("Phase 3B Hub dashboard", () => {
  it("shows loading placeholders while dashboard data loads", () => {
    const html = renderHome({ dashboard: null, loading: true });
    expect(html).toContain("Classes loading");
    expect(html).toContain("Needs attention loading");
    expect(html).toContain('aria-busy="true"');
    expectNoPhase3AMocks(html);
  });

  it("renders the real response and teacher name", () => {
    const html = renderHome();
    expect(html).toContain("Dr. Okafor");
    expect(html).toContain(">6</strong>");
    expect(html).toContain(">14</strong>");
    expect(html).toContain(">132</strong>");
    expect(html).toContain(">3</strong>");
    expect(html).toContain("14 papers to grade");
  });

  it("renders zero counts instead of treating them as unavailable", () => {
    const html = renderHome({ dashboard: { ...dashboard, classes: 0, toGrade: 0, students: 0, reminders: 0, needsAttention: [] } });
    expect(html.match(/>0<\/strong>/g)).toHaveLength(4);
    expect(html).toContain("Nothing needs attention right now.");
  });

  it("keeps the dashboard visible with a non-blocking failure and retry", () => {
    const html = renderHome({ dashboard: null, dashboardError: true, unavailable: true, onRetry: vi.fn() });
    expect(html).toContain("Dashboard data unavailable");
    expect(html).toContain(">Retry</button>");
    expect(html).toContain("Ask TeacherLyft");
    expect(html).toContain("Needs Attention");
    expect(html).toContain("—");
    expectNoPhase3AMocks(html);
  });

  it("keeps the shell visible offline and marks values unavailable", () => {
    const html = renderToStaticMarkup(createElement(HubDashboard, {
      connection: "offline",
      teacherName: null,
      retrying: false,
      onRetry: vi.fn(),
    }));
    expect(html).toContain("Offline · Retry");
    expect(html).toContain("Dashboard values are unavailable while offline.");
    expect(html).toContain("Ask TeacherLyft");
    expect(html).toContain("—");
    expectNoPhase3AMocks(html);
  });

  it("cannot render old Phase 3A attention copy in normal runtime states", () => {
    expectNoPhase3AMocks(renderHome({ dashboard: null, loading: true }));
    expectNoPhase3AMocks(renderHome({ dashboard: null, dashboardError: true, unavailable: true }));
  });

  it("has no Phase 3A mock values in the production dashboard source", () => {
    const source = [
      "src/renderer/components/HomeDashboard.tsx",
      "src/renderer/components/HubDashboard.tsx",
    ].map((file) => readFileSync(file, "utf8")).join("\n");

    expectNoPhase3AMocks(source);
    for (const fakeValue of oldMockStatValues) expect(source).not.toContain(fakeValue);
  });

  it("can keep current-session real values visible offline", () => {
    const html = renderHome({ dashboard, unavailable: false });
    expect(html).toContain(">6</strong>");
    expect(html).toContain(">14</strong>");
    expect(html).toContain(">132</strong>");
    expect(html).toContain(">3</strong>");
    expect(html).toContain("14 papers to grade");
  });
});
