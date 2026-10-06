import { useCallback, useEffect, useState } from "react";
import type { DashboardResponse } from "@/shared/dashboard-types";
import type { HubContent } from "@/shared/content-types";
import { BottomNav, type HubTab } from "@/renderer/components/BottomNav";
import { HomeDashboard } from "@/renderer/components/HomeDashboard";
import { AssignmentsPage, ClassesPage, ProgressPage, SettingsPage, SimpleCardsPage } from "@/renderer/components/ContentPages";
import { TopBar } from "@/renderer/components/TopBar";

type Props = { connection: "connected" | "offline"; teacherName: string | null; retrying: boolean; onRetry: () => void };
type ContentState = Partial<HubContent>;
type BridgeLoad = keyof Pick<NonNullable<Window["teacherlyft"]>, "getClasses" | "getAssignments" | "getStudentProgress" | "getCurriculum" | "getDrafts" | "getLibrary">;
const loaderFor: Partial<Record<HubTab, BridgeLoad>> = { classes: "getClasses", assignments: "getAssignments", students: "getStudentProgress", curriculum: "getCurriculum", drafts: "getDrafts", library: "getLibrary" };
const dataKeyFor = { classes: "classes", assignments: "assignments", students: "progress", curriculum: "curriculum", drafts: "drafts", library: "library" } as const;

export function HubDashboard({ connection, teacherName, retrying, onRetry }: Props) {
  const [activeTab, setActiveTab] = useState<HubTab>("home");
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [content, setContent] = useState<ContentState>({});
  const [loading, setLoading] = useState<HubTab | null>(null);
  const [errors, setErrors] = useState<Partial<Record<HubTab, boolean>>>({});

  const refreshDashboard = useCallback(async () => {
    if (!window.teacherlyft || connection !== "connected") return;
    setLoading("home"); setErrors((value) => ({ ...value, home: false }));
    try { const result = await window.teacherlyft.getDashboard(); if (result.ok) setDashboard(result.dashboard); else setErrors((v) => ({ ...v, home: true })); }
    catch { setErrors((v) => ({ ...v, home: true })); } finally { setLoading(null); }
  }, [connection]);

  const loadSection = useCallback(async (tab: HubTab) => {
    const bridge = window.teacherlyft;
    const loader = loaderFor[tab];
    if (!bridge || !loader || connection !== "connected") return;
    setLoading(tab); setErrors((value) => ({ ...value, [tab]: false }));
    try {
      const result = await bridge[loader]();
      const key = dataKeyFor[tab as keyof typeof dataKeyFor];
      if (result.ok) setContent((value) => ({ ...value, [key]: result.data }));
      else setErrors((value) => ({ ...value, [tab]: true }));
    } catch { setErrors((value) => ({ ...value, [tab]: true })); }
    finally { setLoading(null); }
  }, [connection]);

  useEffect(() => { if (connection === "connected") void refreshDashboard(); }, [connection, refreshDashboard]);
  useEffect(() => {
    if (activeTab === "home" || activeTab === "settings") return;
    const key = dataKeyFor[activeTab];
    if (!content[key]) void loadSection(activeTab);
  }, [activeTab, content, loadSection]);

  const refresh = () => activeTab === "home" ? void refreshDashboard() : void loadSection(activeTab);
  const busy = loading === activeTab;
  const key = activeTab !== "home" && activeTab !== "settings" ? dataKeyFor[activeTab] : null;
  const error = Boolean(errors[activeTab]) || Boolean(connection === "offline" && key && !content[key]);
  const page = activeTab === "home" ? <HomeDashboard dashboard={dashboard} loading={loading === "home" && !dashboard} teacherName={dashboard?.teacherName || teacherName || "Teacher"} unavailable={!dashboard && connection === "offline"} dashboardError={Boolean(errors.home)} onRetry={() => void refreshDashboard()} onNavigate={setActiveTab}/>
    : activeTab === "classes" ? <ClassesPage items={content.classes?.classes ?? []} loading={busy} error={error}/>
    : activeTab === "assignments" ? <AssignmentsPage items={content.assignments?.assignments ?? []} loading={busy} error={error}/>
    : activeTab === "students" ? <ProgressPage classes={content.progress?.classes ?? []} loading={busy} error={error}/>
    : activeTab === "curriculum" ? <SimpleCardsPage title="Curriculum" subtitle="My Curriculum textbooks and processing status" items={content.curriculum?.textbooks ?? []} loading={busy} error={error} unavailable={content.curriculum?.available === false}/>
    : activeTab === "drafts" ? <SimpleCardsPage title="Drafts" subtitle="Classroom work still needing TeacherLyft setup" items={content.drafts?.drafts ?? []} loading={busy} error={error}/>
    : activeTab === "library" ? <SimpleCardsPage title="Library" subtitle="Solution concepts and existing teaching methods" items={content.library?.concepts ?? []} loading={busy} error={error}/>
    : <SettingsPage connection={connection} onDisconnect={() => void window.teacherlyft?.localDisconnect().then(() => window.location.reload())}/>;

  return <div className="hub-shell"><BottomNav active={activeTab} onChange={setActiveTab}/><div className="hub-main"><TopBar connection={connection} onRetry={onRetry} retrying={retrying} onRefresh={refresh} refreshing={busy}/><main className="hub-content">{page}</main></div></div>;
}
