import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";

function formatDay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatWeek(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const end = new Date(Date.UTC(y, m - 1, d));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const opts = { month: "short", day: "numeric", timeZone: "UTC" };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

export default function Stats() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    Promise.all([api.getStats(), api.getHistory()])
      .then(([s, h]) => {
        if (!live) return;
        setStats(s.goals);
        setHistory(h);
      })
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, []);

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-title">
          <h1>Stats</h1>
          <span className="subtitle">Streaks &amp; history</span>
        </div>
        <div className="topbar-actions">
          <Link to="/" className="btn-ghost">← Back</Link>
        </div>
      </header>

      {error && <p className="banner error">{error}</p>}
      {(stats === null || history === null) && !error && <p className="muted center">Loading…</p>}

      {stats && (
        <section className="goal-section">
          <h2 className="section-title">Current streaks</h2>
          <ul className="streak-list">
            {stats.length === 0 && <li className="muted">No goals yet.</li>}
            {stats.map((g) => (
              <li key={g.id} className="streak-item">
                <span className="goal-icon">{g.icon}</span>
                <span className="goal-label">{g.label}</span>
                <span className={`streak-badge ${g.streak > 0 ? "hot" : ""}`}>
                  {g.streak > 0 ? `🔥 ${g.streak} ${g.frequency === "weekly" ? (g.streak === 1 ? "week" : "weeks") : (g.streak === 1 ? "day" : "days")}` : "— no streak"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {history && (
        <>
          <HistoryBlock title="Daily history" rows={history.daily} labelFor={formatDay} keyField="date" />
          <HistoryBlock title="Weekly history" rows={history.weekly} labelFor={formatWeek} keyField="weekEnding" />
        </>
      )}
    </div>
  );
}

function HistoryBlock({ title, rows, labelFor, keyField }) {
  if (!rows || rows.length === 0) return null;
  return (
    <section className="goal-section">
      <h2 className="section-title">{title}</h2>
      <ul className="history-list">
        {rows.map((row) => {
          const date = row[keyField];
          const done = row.goals.filter((g) => g.completed).length;
          return (
            <li key={date} className="history-row">
              <div className="history-date">{labelFor(date)}</div>
              <div className="history-icons">
                {row.goals.map((g) => (
                  <span key={g.id} className={`history-chip ${g.completed ? "done" : "miss"}`} title={g.label}>
                    {g.icon}
                  </span>
                ))}
              </div>
              <div className="history-count">{done}/{row.goals.length}</div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
