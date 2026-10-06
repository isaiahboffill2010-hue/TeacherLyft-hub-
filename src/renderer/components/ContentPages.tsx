import { useState } from "react";
import type { HubAssignment, HubClass, HubConcept, HubDraft, HubProgressClass, HubTextbook } from "@/shared/content-types";

export function DataState({ loading, error, empty, children }: { loading: boolean; error: boolean; empty: boolean; children: React.ReactNode }) {
  if (loading) return <div className="screen-state" aria-busy="true">Loading current TeacherLyft data…</div>;
  if (error) return <div className="screen-state error-panel">This section is unavailable. Check the connection and try Refresh.</div>;
  if (empty) return <div className="screen-state">Nothing to show yet.</div>;
  return <>{children}</>;
}

export function ClassesPage({ items, loading, error }: { items: HubClass[]; loading: boolean; error: boolean }) {
  const [selected, setSelected] = useState<HubClass | null>(null);
  return <Page title="Classes" subtitle="Google Classroom courses and rosters"><DataState loading={loading} error={error} empty={!items.length}>
    {selected && <Detail title={selected.name} onClose={() => setSelected(null)}><p>{selected.section || "No section"} · {selected.studentCount} students</p><h3>Roster</h3>{selected.students.map((s) => <div className="mini-row" key={s.id}>{s.name}</div>)}</Detail>}
    <div className="content-grid">{items.map((item) => <button className="content-card" key={item.id} onClick={() => setSelected(item)}><span className="badge">{item.period || "Class"}</span><h2>{item.name}</h2><p>{item.studentCount} students</p></button>)}</div>
  </DataState></Page>;
}

export function AssignmentsPage({ items, loading, error, initialToGrade = false }: { items: HubAssignment[]; loading: boolean; error: boolean; initialToGrade?: boolean }) {
  const [filter, setFilter] = useState(initialToGrade ? "review" : "all");
  const [selected, setSelected] = useState<HubAssignment | null>(null);
  const shown = items.filter((a) => filter === "all" || filter === "review" && a.toGradeCount > 0 || filter === "upcoming" && !!a.dueDate || filter === "completed" && a.toGradeCount === 0 && a.gradedCount > 0);
  return <Page title="Assignments" subtitle="Live Google Classroom work and TeacherLyft review status"><div className="filter-row">{[["all","All"],["review","Needs Review"],["upcoming","Upcoming"],["completed","Completed"]].map(([id,label]) => <button className={filter === id ? "active" : ""} onClick={() => setFilter(id)} key={id}>{label}</button>)}</div><DataState loading={loading} error={error} empty={!shown.length}>
    {selected && <Detail title={selected.title} onClose={() => setSelected(null)}><p>{selected.className}</p><dl className="detail-stats"><dt>Due</dt><dd>{selected.dueDate || "No due date"}</dd><dt>Submitted</dt><dd>{selected.submissionCount}</dd><dt>To grade</dt><dd>{selected.toGradeCount}</dd></dl></Detail>}
    <div className="list-cards">{shown.map((a) => <button className="list-card" key={`${a.classId}:${a.id}`} onClick={() => setSelected(a)}><div><span className="badge">{a.type}</span><h2>{a.title}</h2><p>{a.className} · {a.dueDate || "No due date"}</p></div><strong>{a.toGradeCount} to grade</strong></button>)}</div>
  </DataState></Page>;
}

export function ProgressPage({ classes, loading, error }: { classes: HubProgressClass[]; loading: boolean; error: boolean }) {
  const [selected, setSelected] = useState<HubProgressClass | null>(null);
  return <Page title="Student Progress" subtitle="Completion, missing work, and existing TeacherLyft signals"><DataState loading={loading} error={error} empty={!classes.length}>
    {selected && <Detail title={selected.class_name} onClose={() => setSelected(null)}>{selected.students.map((s) => <button className="mini-row" key={s.id}>{s.name}</button>)}</Detail>}
    <div className="content-grid">{classes.map((c) => <button className="content-card" key={c.id} onClick={() => setSelected(c)}><h2>{c.class_name}</h2><p>{c.student_count} students · {c.missing_count} missing</p><strong>{c.avg_grade === null ? "No grades yet" : `${c.avg_grade}% average`}</strong></button>)}</div>
  </DataState></Page>;
}

export function SimpleCardsPage({ title, subtitle, items, loading, error, unavailable }: { title: string; subtitle: string; items: Array<HubDraft | HubTextbook | HubConcept>; loading: boolean; error: boolean; unavailable?: boolean }) {
  return <Page title={title} subtitle={subtitle}>{unavailable ? <div className="screen-state">This TeacherLyft feature is not available on this account yet.</div> : <DataState loading={loading} error={error} empty={!items.length}><div className="content-grid">{items.map((item) => {
    const isConcept = "concept_name" in item;
    const isDraft = "className" in item;
    const label = isConcept ? item.subject : isDraft ? item.className : item.subject || item.status;
    const heading = isConcept ? item.concept_name : item.title;
    const detail = isConcept ? item.description : isDraft ? item.dueDate : item.publisher;
    return <article className="content-card" key={item.id}><span className="badge">{label || title}</span><h2>{heading || "Untitled"}</h2><p>{detail || "View-only on Hub"}</p></article>;
  })}</div></DataState>}</Page>;
}

export function SettingsPage({ connection, onDisconnect }: { connection: string; onDisconnect: () => void }) { return <Page title="Settings" subtitle="Device settings and safe account controls"><div className="settings-panels"><section className="content-card"><h2>Device Settings</h2><p>Status: {connection}</p><p>TeacherLyft Hub 0.1.0</p><button className="danger-button" onClick={onDisconnect}>Disconnect this device</button></section><section className="content-card"><h2>TeacherLyft Settings</h2><p>Billing, Google connection, and account security are managed in TeacherLyft.</p></section></div></Page>; }

function Page({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="data-page"><header><p className="section-kicker">TeacherLyft Hub</p><h1>{title}</h1><p>{subtitle}</p></header>{children}</section>; }
function Detail({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <section className="detail-panel"><div className="section-heading"><h2>{title}</h2><button onClick={onClose}>Close</button></div>{children}</section>; }
