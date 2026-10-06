import type { DashboardAttentionKind, DashboardResponse } from "@/shared/dashboard-types";
import { HubIcon, type IconName } from "@/renderer/components/HubIcon";
import { VoiceAssistant } from "@/renderer/components/VoiceAssistant";

const statDefinitions: Array<{ key: "classes" | "toGrade" | "students" | "reminders"; label: string; icon: IconName; tone: string }> = [
  { key: "classes", label: "Classes", icon: "classes", tone: "blue" },
  { key: "toGrade", label: "To Grade", icon: "clipboard", tone: "violet" },
  { key: "students", label: "Students", icon: "students", tone: "green" },
  { key: "reminders", label: "Reminders", icon: "bell", tone: "orange" },
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
  onNavigate?: (target: "classes" | "assignments" | "progress" | "more") => void;
};

export function HomeDashboard({ dashboard, loading, teacherName, unavailable, dashboardError = false, onRetry, onNavigate }: Props) {
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

    <VoiceAssistant offline={unavailable}/>

    <section className="stats-grid" aria-label="Classroom statistics" aria-busy={loading}>
      {statDefinitions.map((stat) => <button className="stat-card" key={stat.key} onClick={() => onNavigate?.(stat.key === "classes" ? "classes" : stat.key === "toGrade" ? "assignments" : stat.key === "students" ? "progress" : "more")}>
        <div className={`icon-tile ${stat.tone}`}><HubIcon name={stat.icon}/></div>
        <div><span>{stat.label}</span>
          {loading ? <span className="stat-skeleton" aria-label={`${stat.label} loading`} /> : <strong>{dashboard ? dashboard[stat.key] : "—"}</strong>}
          <p>{loading ? "Loading..." : dashboard ? "Current value" : "Unavailable"}</p>
        </div>
      </button>)}
    </section>

    <section className="attention-section" aria-busy={loading}>
      <div className="section-heading"><div><p className="section-kicker">Stay ahead</p><h2>Needs Attention</h2></div>
        <span>{loading ? "Loading..." : dashboard ? `${dashboard.needsAttention.length} items` : "Unavailable"}</span></div>
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
