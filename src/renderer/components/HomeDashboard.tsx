import { useState } from "react";
import { HubIcon, type IconName } from "@/renderer/components/HubIcon";

const stats: Array<{ label: string; value: number; subtitle: string; icon: IconName; tone: string }> = [
  { label: "Classes", value: 5, subtitle: "Active classes this term", icon: "classes", tone: "blue" },
  { label: "To Grade", value: 12, subtitle: "Assignments waiting", icon: "clipboard", tone: "violet" },
  { label: "Students", value: 128, subtitle: "Total students", icon: "students", tone: "green" },
  { label: "Reminders", value: 4, subtitle: "Upcoming items", icon: "bell", tone: "orange" },
];

const attention = [
  { title: "Algebra quiz needs review", detail: "Period 3 · 28 submissions pending", tone: "violet", icon: "clipboard" as const },
  { title: "3 students missing Assignment 4", detail: "Period 1 · Due Apr 25", tone: "orange", icon: "students" as const },
  { title: "Period 2 average dropped 6%", detail: "From 78% to 72% on last two assessments", tone: "blue", icon: "classes" as const },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function HomeDashboard({ teacherName }: { teacherName: string }) {
  const [voiceNotice, setVoiceNotice] = useState(false);
  return <>
    <section className="greeting-block">
      <p className="section-kicker">Today’s overview</p>
      <h1>{greeting()}, {teacherName}</h1>
      <p>Here’s what’s happening in your classroom today.</p>
    </section>

    <section className="ask-card">
      <button className="microphone-button" onClick={() => setVoiceNotice(true)} aria-label="Ask TeacherLyft by voice"><HubIcon name="microphone"/></button>
      <div><p className="section-kicker">Your teaching copilot</p><h2>Ask TeacherLyft</h2><p>Get instant help with lessons, grading, student insights, and more.</p></div>
      <button className="voice-pill" onClick={() => setVoiceNotice(true)}><span aria-hidden="true" />Tap to start speaking</button>
      {voiceNotice && <p className="voice-notice" role="status">Voice assistant coming in Phase 3E</p>}
    </section>

    <section className="stats-grid" aria-label="Classroom statistics">
      {stats.map((stat) => <article className="stat-card" key={stat.label}>
        <div className={`icon-tile ${stat.tone}`}><HubIcon name={stat.icon}/></div>
        <div><span>{stat.label}</span><strong>{stat.value}</strong><p>{stat.subtitle}</p></div>
      </article>)}
    </section>

    <section className="attention-section">
      <div className="section-heading"><div><p className="section-kicker">Stay ahead</p><h2>Needs Attention</h2></div><span>3 items</span></div>
      <div className="attention-list">
        {attention.map((item) => <article className="attention-row" key={item.title}>
          <div className={`icon-tile ${item.tone}`}><HubIcon name={item.icon}/></div>
          <div><strong>{item.title}</strong><p>{item.detail}</p></div>
          <HubIcon className="row-arrow" name="arrow"/>
        </article>)}
      </div>
    </section>
  </>;
}
