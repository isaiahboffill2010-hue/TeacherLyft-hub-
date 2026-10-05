import { useEffect, useState } from "react";

type Props = {
  connection: "connected" | "offline";
  onRetry: () => void;
  retrying: boolean;
  onRefresh: () => void;
  refreshing: boolean;
};

function currentMinute(): Date {
  return new Date();
}

export function TopBar({ connection, onRetry, retrying, onRefresh, refreshing }: Props) {
  const [now, setNow] = useState(currentMinute);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(currentMinute()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return <header className="hub-topbar">
    <div className="hub-brand">
      <div className="hub-logo" aria-hidden="true">TL</div>
      <div><strong>TeacherLyft Hub</strong><span>Less Work. More Teaching.</span></div>
    </div>
    <div className="hub-topbar-right">
      {connection === "connected" && <button className="refresh-button" onClick={onRefresh} disabled={refreshing}>
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>}
      <button className={`connection-pill ${connection}`} onClick={connection === "offline" ? onRetry : undefined} disabled={retrying || connection === "connected"}>
        <span aria-hidden="true" />{retrying ? "Checking…" : connection === "connected" ? "Connected" : "Offline · Retry"}
      </button>
      <div className="live-clock" aria-label="Current time and date">
        <strong>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</strong>
        <span>{now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</span>
      </div>
    </div>
  </header>;
}
