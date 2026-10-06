import { useCallback, useEffect, useState } from "react";
import type { DashboardResponse } from "@/shared/dashboard-types";
import type { DetailKind, DetailRequest, HubContent } from "@/shared/content-types";
import { BottomNav, type HubTab } from "@/renderer/components/BottomNav";
import { HomeDashboard } from "@/renderer/components/HomeDashboard";
import { AssignmentsPage, ClassesPage, CurriculumPage, DraftsPage, LibraryPage, MorePage, ProgressPage, SettingsPage, type MoreSection } from "@/renderer/components/ContentPages";
import { TopBar } from "@/renderer/components/TopBar";
import { DetailPage } from "@/renderer/components/DetailPage";

type Props = { connection: "connected" | "offline"; teacherName: string | null; retrying: boolean; onRetry: () => void };
type Section = HubTab | MoreSection;
type ContentState = Partial<HubContent>;
type BridgeLoad = keyof Pick<NonNullable<Window["teacherlyft"]>, "getClasses" | "getAssignments" | "getStudentProgress" | "getCurriculum" | "getDrafts" | "getLibrary">;
const loaderFor: Partial<Record<Section, BridgeLoad>> = { classes: "getClasses", assignments: "getAssignments", progress: "getStudentProgress", curriculum: "getCurriculum", drafts: "getDrafts", library: "getLibrary" };
const dataKeyFor = { classes: "classes", assignments: "assignments", progress: "progress", curriculum: "curriculum", drafts: "drafts", library: "library" } as const;

export function HubDashboard({ connection, teacherName, retrying, onRetry }: Props) {
  const [activeSection, setActiveSection] = useState<Section>("home");
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [content, setContent] = useState<ContentState>({});
  const [loading, setLoading] = useState<Section | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Section, boolean>>>({});
  const [detail, setDetail] = useState<{ request: DetailRequest; data: Record<string, unknown> | null; loading: boolean; error: boolean } | null>(null);

  const openDetail = useCallback(async (request: DetailRequest) => {
    setDetail({ request, data: null, loading: true, error: false });
    try { const result = await window.teacherlyft?.getDetail(request); setDetail(result?.ok ? { request, data: result.data, loading: false, error: false } : { request, data: null, loading: false, error: true }); }
    catch { setDetail({ request, data: null, loading: false, error: true }); }
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (!window.teacherlyft || connection !== "connected") return;
    setLoading("home"); setErrors((value) => ({ ...value, home: false }));
    try { const result = await window.teacherlyft.getDashboard(); if (result.ok) setDashboard(result.dashboard); else setErrors((v) => ({ ...v, home: true })); }
    catch { setErrors((v) => ({ ...v, home: true })); } finally { setLoading(null); }
  }, [connection]);

  const loadSection = useCallback(async (section: Section) => {
    const bridge = window.teacherlyft;
    const loader = loaderFor[section];
    if (!bridge || !loader || connection !== "connected") return;
    setLoading(section); setErrors((value) => ({ ...value, [section]: false }));
    try {
      const result = await bridge[loader]();
      const key = dataKeyFor[section as keyof typeof dataKeyFor];
      if (result.ok) setContent((value) => ({ ...value, [key]: result.data }));
      else setErrors((value) => ({ ...value, [section]: true }));
    } catch { setErrors((value) => ({ ...value, [section]: true })); }
    finally { setLoading(null); }
  }, [connection]);

  useEffect(() => { if (connection === "connected") void refreshDashboard(); }, [connection, refreshDashboard]);
  useEffect(() => {
    if (!(activeSection in dataKeyFor)) return;
    const key = dataKeyFor[activeSection as keyof typeof dataKeyFor];
    if (!content[key]) void loadSection(activeSection);
  }, [activeSection, content, loadSection]);

  const selectPrimary = (tab: HubTab) => setActiveSection(tab);
  const refresh = () => detail ? void openDetail(detail.request) : activeSection === "home" ? void refreshDashboard() : void loadSection(activeSection);
  const busy = loading === activeSection;
  const key = activeSection in dataKeyFor ? dataKeyFor[activeSection as keyof typeof dataKeyFor] : null;
  const error = Boolean(errors[activeSection]) || Boolean(connection === "offline" && key && !content[key]);
  const page = activeSection === "home" ? <HomeDashboard dashboard={dashboard} loading={loading === "home" && !dashboard} teacherName={dashboard?.teacherName || teacherName || "Teacher"} unavailable={!dashboard && connection === "offline"} dashboardError={Boolean(errors.home)} onRetry={() => void refreshDashboard()} onNavigate={selectPrimary}/>
    : activeSection === "classes" ? <ClassesPage items={content.classes?.classes ?? []} loading={busy} error={error} onOpenClass={(id)=>void openDetail({kind:"class",id})} onOpenStudent={(classId,id)=>void openDetail({kind:"student",classId,id})}/>
    : activeSection === "assignments" ? <AssignmentsPage items={content.assignments?.assignments ?? []} loading={busy} error={error} onOpen={(id)=>void openDetail({kind:"assignment",id})}/>
    : activeSection === "progress" ? <ProgressPage classes={content.progress?.classes ?? []} loading={busy} error={error} onOpenClass={(id)=>void openDetail({kind:"class",id})}/>
    : activeSection === "more" ? <MorePage onOpen={setActiveSection}/>
    : activeSection === "curriculum" ? <CurriculumPage items={content.curriculum?.textbooks ?? []} loading={busy} error={error} unavailable={content.curriculum?.available === false} onOpen={(id)=>void openDetail({kind:"curriculum",id})}/>
    : activeSection === "drafts" ? <DraftsPage items={content.drafts?.drafts ?? []} loading={busy} error={error} onOpen={(id)=>void openDetail({kind:"draft",id})}/>
    : activeSection === "library" ? <LibraryPage items={content.library?.concepts ?? []} loading={busy} error={error} onOpen={(id)=>void openDetail({kind:"library",id})}/>
    : <SettingsPage connection={connection} onDisconnect={() => void window.teacherlyft?.localDisconnect().then(() => window.location.reload())}/>;

  const activeTab: HubTab = activeSection === "curriculum" || activeSection === "drafts" || activeSection === "library" || activeSection === "settings" ? "more" : activeSection;
  const visible = detail ? <DetailPage kind={detail.request.kind as DetailKind} data={detail.data} loading={detail.loading} error={detail.error} onBack={()=>setDetail(null)} onRetry={()=>void openDetail(detail.request)} onOpenStudent={(classId,id)=>void openDetail({kind:"student",classId,id})}/> : page;
  return <div className="hub-shell"><TopBar connection={connection} onRetry={onRetry} retrying={retrying} onRefresh={refresh} refreshing={busy}/><main className="hub-content">{!detail&&activeSection !== "more" && activeTab === "more" && <button className="back-to-more" onClick={() => setActiveSection("more")}>‹ More</button>}{visible}</main><BottomNav active={activeTab} onChange={(tab)=>{setDetail(null);selectPrimary(tab)}}/></div>;
}
