import { useState } from "react";
import type { DashboardAttentionKind, DashboardResponse } from "@/shared/dashboard-types";
import { HubIcon, type IconName } from "@/renderer/components/HubIcon";

const statDefinitions: Array<{ key: "classes" | "toGrade" | "students" | "reminders"; label: string; subtitle: string; icon: IconName; tone: string }> = [
  { key: "classes", label: "Classes", subtitle: "Active classes this term", icon: "classes", tone: "blue" },
  { key: "toGrade", label: "To Grade", subtitle: "Assignments waiting", icon: "clipboard", tone: "violet" },
  { key: "students", label: "Students", subtitle: "Total students", icon: "students", tone: "green" },
  { key: "reminders", label: "Reminders", subtitle: "Upcoming items", icon: "bell", tone: "orange" },
];

const attentionStyle: Record<DashboardAttentionKind, { tone: string; icon: IconName }> = {
  grading: { tone: "violet", icon: "clipboard" },
  student: { tone: "orange", icon: "students" },
  class: { tone: "blue", icon: "classes" },
  reminder: { tone: "orange", icon: "bell" },
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

type Props = {
  dashboard: DashboardResponse | null;
  loading: boolean;
  teacherName: string;
  unavailable: boolean;
  dashboardError?: boolean;
  onRetry?: () => void;
};

export function HomeDashboard({ dashboard, loading, teacherName, unavailable, dashboardError = false, onRetry }: Props) {
  const [voiceNotice, setVoiceNotice] = useState(false);
  return <>
    {dashboardError && <div className="dashboard-message" role="status">
      <span>Dashboard data unavailable</span>
      <button onClick={onRetry} disabled={loading}>Retry</button>
    </div>}
    <section className="greeting-block">
      <p className="section-kicker">Today's overview</p>
      <h1>{greeting()}, {teacherName}</h1>
      <p>Here's what's happening in your classroom today.</p>
    </section>

    <section className="ask-card">
      <button className="microphone-button" onClick={() => setVoiceNotice(true)} aria-label="Ask TeacherLyft by voice"><HubIcon name="microphone"/></button>
      <div><p className="section-kicker">Your teaching copilot</p><h2>Ask TeacherLyft</h2><p>Get instant help with lessons, grading, student insights, and more.</p></div>
      <button className="voice-pill" onClick={() => setVoiceNotice(true)}><span aria-hidden="true" />Tap to start speaking</button>
      {voiceNotice && <p className="voice-notice" role="status">Voice assistant coming in Phase 3E</p>}
    </section>

    <section className="stats-grid" aria-label="Classroom statistics" aria-busy={loading}>
      {statDefinitions.map((stat) => <article className="stat-card" key={stat.key}>
        <div className={`icon-tile ${stat.tone}`}><HubIcon name={stat.icon}/></div>
        <div><span>{stat.label}</span>
          {loading ? <span className="stat-skeleton" aria-label={`${stat.label} loading`} /> : <strong>{dashboard ? dashboard[stat.key] : "—"}</strong>}
          <p>{stat.subtitle}</p>
        </div>
      </article>)}
    </section>

    <section className="attention-section" aria-busy={loading}>
      <div className="section-heading"><div><p className="section-kicker">Stay ahead</p><h2>Needs Attention</h2></div>
        <span>{loading ? "Loading…" : dashboard ? `${dashboard.needsAttention.length} items` : "Unavailable"}</span></div>
      <div className="attention-list">
        {loading && [0, 1, 2].map((key) => <div className="attention-skeleton" key={key} aria-label="Needs attention loading" />)}
        {!loading && dashboard?.needsAttention.map((item) => {
          const style = attentionStyle[item.kind];
          return <article className="attention-row" key={item.id}>
            <div className={`icon-tile ${style.tone}`}><HubIcon name={style.icon}/></div>
            <div><strong>{item.title}</strong><p>{item.detail}</p></div>
            <HubIcon className="row-arrow" name="arrow"/>
          </article>;
        })}
        {!loading && dashboard && dashboard.needsAttention.length === 0 && <p className="empty-attention">Nothing needs attention right now.</p>}
        {!loading && unavailable && <p className="empty-attention">Dashboard values are unavailable while offline.</p>}
      </div>
    </section>
  </>;
}
