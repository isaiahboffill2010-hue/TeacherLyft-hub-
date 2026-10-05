import { useCallback, useEffect, useState } from "react";
import type { DashboardResponse } from "@/shared/dashboard-types";
import { BottomNav, type HubTab } from "@/renderer/components/BottomNav";
import { HomeDashboard } from "@/renderer/components/HomeDashboard";
import { HubIcon } from "@/renderer/components/HubIcon";
import { TopBar } from "@/renderer/components/TopBar";

const placeholderCopy: Record<Exclude<HubTab, "home">, { title: string; message: string }> = {
  assistant: { title: "Assistant", message: "Your full voice and teaching assistant arrives in Phase 3E." },
  classes: { title: "Classes", message: "Class details and learning activity are coming in Phase 3B." },
  students: { title: "Students", message: "Student progress and insights are coming in Phase 3C." },
  settings: { title: "Settings", message: "Hub preferences and device controls are coming in Phase 3D." },
};

type Props = {
  connection: "connected" | "offline";
  teacherName: string | null;
  retrying: boolean;
  onRetry: () => void;
};

export function HubDashboard({ connection, teacherName, retrying, onRetry }: Props) {
  const [activeTab, setActiveTab] = useState<HubTab>("home");
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState(false);
  const copy = activeTab === "home" ? null : placeholderCopy[activeTab];

  const refreshDashboard = useCallback(async () => {
    const bridge = window.teacherlyft;
    if (!bridge || connection !== "connected") return;
    setLoadingDashboard(true);
    setDashboardError(false);
    try {
      const result = await bridge.getDashboard();
      if (result.ok) setDashboard(result.dashboard);
      else setDashboardError(true);
    } catch {
      setDashboardError(true);
    } finally {
      setLoadingDashboard(false);
    }
  }, [connection]);

  useEffect(() => {
    if (connection === "connected") void refreshDashboard();
  }, [connection, refreshDashboard]);

  return <div className="hub-shell">
    <TopBar connection={connection} onRetry={onRetry} retrying={retrying}
      onRefresh={() => void refreshDashboard()} refreshing={loadingDashboard}/>
    <main className="hub-content">
      {copy ? <section className="placeholder-screen">
        <div className="placeholder-icon"><HubIcon name={activeTab}/></div>
        <p className="section-kicker">TeacherLyft Hub</p><h1>{copy.title}</h1><p>{copy.message}</p>
        <button className="primary home-button" onClick={() => setActiveTab("home")}><HubIcon name="home"/>Back to Home</button>
      </section> : <HomeDashboard dashboard={dashboard} loading={loadingDashboard && dashboard === null}
          teacherName={dashboard?.teacherName || teacherName || "Teacher"}
          unavailable={dashboard === null && (connection === "offline" || dashboardError)}
          dashboardError={dashboardError && connection === "connected"}
          onRetry={() => void refreshDashboard()}/>}
    </main>
    <BottomNav active={activeTab} onChange={setActiveTab}/>
  </div>;
}
