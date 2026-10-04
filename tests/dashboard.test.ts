import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HubDashboard } from "@/renderer/components/HubDashboard";

function renderDashboard(connection: "connected" | "offline", teacherName: string | null = "Ms. Rivera") {
  return renderToStaticMarkup(createElement(HubDashboard, {
    connection,
    teacherName,
    retrying: false,
    onRetry: vi.fn(),
  }));
}

describe("Phase 3A Hub dashboard", () => {
  it("renders the connected home dashboard with teacher context and mock classroom data", () => {
    const html = renderDashboard("connected");
    expect(html).toContain("Ms. Rivera");
    expect(html).toContain("Ask TeacherLyft");
    expect(html).toContain("Active classes this term");
    expect(html).toContain("Assignments waiting");
    expect(html).toContain("Total students");
    expect(html).toContain("Upcoming items");
    expect(html).toContain("Algebra quiz needs review");
    expect(html).toContain('aria-current="page"');
  });

  it("keeps the dashboard visible offline and falls back to Teacher", () => {
    const html = renderDashboard("offline", null);
    expect(html).toContain("Teacher</h1>");
    expect(html).toContain("Offline · Retry");
    expect(html).toContain("Ask TeacherLyft");
  });
});
