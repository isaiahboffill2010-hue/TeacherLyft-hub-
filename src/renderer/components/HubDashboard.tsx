import { useState } from "react";
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
  const copy = activeTab === "home" ? null : placeholderCopy[activeTab];

  return <div className="hub-shell">
    <TopBar connection={connection} onRetry={onRetry} retrying={retrying}/>
    <main className="hub-content">
      {copy ? <section className="placeholder-screen">
        <div className="placeholder-icon"><HubIcon name={activeTab}/></div>
        <p className="section-kicker">TeacherLyft Hub</p><h1>{copy.title}</h1><p>{copy.message}</p>
        <button className="primary home-button" onClick={() => setActiveTab("home")}><HubIcon name="home"/>Back to Home</button>
      </section> : <HomeDashboard teacherName={teacherName || "Teacher"}/>} 
    </main>
    <BottomNav active={activeTab} onChange={setActiveTab}/>
  </div>;
}
