import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";

// ─── Toggle this to preview without auth ──────────────────────────────────────
const USE_MOCK = true;

// ─── Mock data generator ──────────────────────────────────────────────────────
function seededRand(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function generateMockData() {
  const mockGoals = [
    { id: "g1", label: "Morning Run",      icon: "🏃", frequency: "daily", streak: 12 },
    { id: "g2", label: "Read 30 min",      icon: "📚", frequency: "daily", streak: 5  },
    { id: "g3", label: "Meditate",         icon: "🧘", frequency: "daily", streak: 18 },
    { id: "g4", label: "Drink Water",      icon: "💧", frequency: "daily", streak: 22 },
    { id: "g5", label: "Journal",          icon: "✍️", frequency: "daily", streak: 2  },
    { id: "g6", label: "No Social Media",  icon: "📵", frequency: "daily", streak: 0  },
  ];

  // Each goal has a distinct personality — some consistent, some struggling
  const probs = { g1: 0.78, g2: 0.68, g3: 0.90, g4: 0.94, g5: 0.46, g6: 0.29 };

  const daily = [];
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setUTCHours(12, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    // Add a weekend dip for morning run and a mid-week slump for journaling
    const isWeekend = [0, 6].includes(d.getUTCDay());
    const goals = mockGoals.map((g, gi) => {
      let p = probs[g.id];
      if (g.id === "g1" && isWeekend) p *= 0.65;
      if (g.id === "g5" && i % 7 < 2)  p *= 0.55;
      return {
        id: g.id, label: g.label, icon: g.icon,
        completed: seededRand(i * 13 + gi * 7) < p,
      };
    });
    daily.push({ date: dateStr, goals });
  }

  const weekly = [];
  for (let w = 0; w < 8; w++) {
    const end = new Date();
    end.setUTCHours(12, 0, 0, 0);
    end.setUTCDate(end.getUTCDate() - w * 7);
    const weekEnding = end.toISOString().slice(0, 10);
    const goals = mockGoals.map((g, gi) => ({
      id: g.id, label: g.label, icon: g.icon,
      completed: seededRand(w * 19 + gi * 11 + 300) < (probs[g.id] * 1.05),
    }));
    weekly.push({ weekEnding, goals });
  }

  return { goals: mockGoals, history: { daily, weekly } };
}

// ─── Existing helpers (untouched) ─────────────────────────────────────────────
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

// ─── Computed stats helpers ───────────────────────────────────────────────────
function computeSummary(daily) {
  let total = 0, done = 0, perfectDays = 0;
  daily.forEach((row) => {
    const t = row.goals.length;
    const d = row.goals.filter((g) => g.completed).length;
    total += t;
    done += d;
    if (t > 0 && d === t) perfectDays++;
  });
  return {
    completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
    perfectDays,
    totalCompletions: done,
  };
}

function computePerGoal(daily) {
  const map = {};
  daily.forEach((row) => {
    row.goals.forEach((g) => {
      if (!map[g.id]) map[g.id] = { id: g.id, label: g.label, icon: g.icon, total: 0, done: 0 };
      map[g.id].total++;
      if (g.completed) map[g.id].done++;
    });
  });
  return Object.values(map)
    .map((g) => ({ ...g, rate: g.total > 0 ? Math.round((g.done / g.total) * 100) : 0 }))
    .sort((a, b) => b.rate - a.rate);
}

function buildHeatmap(daily) {
  if (!daily?.length) return [];

  const rateByDate = {};
  daily.forEach((row) => {
    const t = row.goals.length;
    const d = row.goals.filter((g) => g.completed).length;
    rateByDate[row.date] = t > 0 ? d / t : null;
  });

  const dates = Object.keys(rateByDate).sort();
  const firstDate = dates[0];
  const lastDate  = dates[dates.length - 1];

  const [fy, fm, fd] = firstDate.split("-").map(Number);
  const [ly, lm, ld] = lastDate.split("-").map(Number);
  const first = new Date(Date.UTC(fy, fm - 1, fd));
  const last  = new Date(Date.UTC(ly, lm - 1, ld));

  const startSunday = new Date(first);
  startSunday.setUTCDate(startSunday.getUTCDate() - startSunday.getUTCDay());

  const endSaturday = new Date(last);
  endSaturday.setUTCDate(endSaturday.getUTCDate() + ((6 - endSaturday.getUTCDay()) % 7));

  const weeks = [];
  const cur = new Date(startSunday);
  while (cur <= endSaturday) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const ds = cur.toISOString().slice(0, 10);
      week.push({ date: ds, rate: rateByDate[ds], inRange: ds >= firstDate && ds <= lastDate });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function heatCellClass(day) {
  if (!day.inRange) return "hc-empty";
  if (day.rate === null || day.rate === undefined) return "hc-none";
  if (day.rate === 0)  return "hc-zero";
  if (day.rate < 0.5)  return "hc-low";
  if (day.rate < 1.0)  return "hc-mid";
  return "hc-full";
}

// ─── CircleRing SVG ───────────────────────────────────────────────────────────
function CircleRing({ value, size = 68 }) {
  const sw = 6;
  const r  = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const dash  = (Math.min(value, 100) / 100) * circ;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: "rotate(-90deg)", display: "block" }}
    >
      <defs>
        <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#34d399" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="var(--surface-2)"
        strokeWidth={sw}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="url(#ring-grad)"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
      />
    </svg>
  );
}

// ─── Summary Cards ────────────────────────────────────────────────────────────
function SummaryCards({ daily }) {
  const { completionRate, perfectDays, totalCompletions } = computeSummary(daily);

  return (
    <div className="stats-cards">
      <div className="stats-card stats-card--ring">
        <div className="ring-wrap">
          <CircleRing value={completionRate} />
          <span className="ring-pct">{completionRate}%</span>
        </div>
        <div className="stats-card-meta">
          <div className="stats-card-label">Completion</div>
          <div className="stats-card-sub">last 30 days</div>
        </div>
      </div>

      <div className="stats-card">
        <div className="stats-big-num stats-big-num--accent">{perfectDays}</div>
        <div className="stats-card-label">Perfect Days</div>
        <div className="stats-card-sub">all goals done</div>
      </div>

      <div className="stats-card">
        <div className="stats-big-num stats-big-num--primary">{totalCompletions}</div>
        <div className="stats-card-label">Completions</div>
        <div className="stats-card-sub">total logged</div>
      </div>
    </div>
  );
}

// ─── Heatmap Grid ─────────────────────────────────────────────────────────────
function HeatmapGrid({ daily }) {
  const weeks    = buildHeatmap(daily);
  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [weeks]);

  return (
    <div className="heatmap-card">
      <div className="heatmap-inner" ref={scrollRef}>
        <div className="heatmap-day-labels">
          {dayLabels.map((l, i) => <span key={i}>{l}</span>)}
        </div>
        <div className="heatmap-weeks">
          {weeks.map((week, wi) => (
            <div key={wi} className="heatmap-col">
              {week.map((day, di) => (
                <div
                  key={di}
                  className={`heatmap-cell ${heatCellClass(day)}`}
                  title={
                    day.inRange && day.rate != null
                      ? `${day.date} · ${Math.round(day.rate * 100)}%`
                      : day.inRange ? day.date : ""
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="heatmap-legend">
        <span className="heatmap-legend-label">Less</span>
        <div className="heatmap-legend-swatches">
          <div className="hc-zero  legend-sw" />
          <div className="hc-low   legend-sw" />
          <div className="hc-mid   legend-sw" />
          <div className="hc-full  legend-sw" />
        </div>
        <span className="heatmap-legend-label">More</span>
      </div>
    </div>
  );
}

// ─── Per-Goal Breakdown ───────────────────────────────────────────────────────
function GoalBreakdown({ daily }) {
  const goals = computePerGoal(daily);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="breakdown-list">
      {goals.map((g, i) => (
        <div
          key={g.id}
          className="breakdown-row"
          style={{ "--stagger": `${i * 55}ms` }}
        >
          <span className="breakdown-icon">{g.icon}</span>
          <div className="breakdown-body">
            <div className="breakdown-top">
              <span className="breakdown-label">{g.label}</span>
              <span className="breakdown-pct">{g.rate}%</span>
            </div>
            <div className="breakdown-track">
              <div
                className="breakdown-fill"
                style={{
                  width: mounted ? `${g.rate}%` : "0%",
                  transitionDelay: mounted ? `${i * 55}ms` : "0ms",
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Stats component ─────────────────────────────────────────────────────
export default function Stats() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (USE_MOCK) {
      const { goals, history: h } = generateMockData();
      setStats(goals);
      setHistory(h);
      return;
    }

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
      {(stats === null || history === null) && !error && (
        <p className="muted center">Loading…</p>
      )}

      {/* ── Streaks — EXACTLY unchanged ── */}
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
                  {g.streak > 0
                    ? `🔥 ${g.streak} ${g.frequency === "weekly" ? (g.streak === 1 ? "week" : "weeks") : (g.streak === 1 ? "day" : "days")}`
                    : "— no streak"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── New sections ── */}
      {history && (
        <>
          <section className="goal-section">
            <h2 className="section-title">Overview · last 30 days</h2>
            <SummaryCards daily={history.daily.slice(0, 30)} />
          </section>

          <section className="goal-section">
            <h2 className="section-title">Year activity</h2>
            <HeatmapGrid daily={history.daily} />
          </section>

          <section className="goal-section">
            <h2 className="section-title">Per goal · 30 days</h2>
            <GoalBreakdown daily={history.daily.slice(0, 30)} />
          </section>

          <HistoryBlock
            title="Weekly history"
            rows={history.weekly}
            labelFor={formatWeek}
            keyField="weekEnding"
          />
        </>
      )}
    </div>
  );
}

// ─── HistoryBlock — unchanged, used for weekly ────────────────────────────────
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
                  <span
                    key={g.id}
                    className={`history-chip ${g.completed ? "done" : "miss"}`}
                    title={g.label}
                  >
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
