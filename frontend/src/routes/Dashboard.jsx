import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { getEmail, signOut } from "../lib/auth.js";

const TODAY_LABEL = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

export default function Dashboard() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState(null);
  const [error, setError] = useState("");
  const [manage, setManage] = useState(false);
  const [busy, setBusy] = useState(false);

  // add-goal form
  const [icon, setIcon] = useState("");
  const [label, setLabel] = useState("");
  const [frequency, setFrequency] = useState("daily");

  useEffect(() => {
    let live = true;
    api.getGoals()
      .then((d) => live && setGoals(d.goals))
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, []);

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  async function toggle(id) {
    // optimistic flip
    setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g)));
    try {
      const { completed } = await api.toggleGoal(id);
      setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, completed } : g)));
    } catch (e) {
      setError(e.message);
      setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g)));
    }
  }

  async function addGoal(e) {
    e.preventDefault();
    if (!label.trim() || busy) return;
    setBusy(true);
    try {
      const { goal } = await api.createGoal(label.trim(), icon.trim() || "🎯", frequency);
      setGoals((gs) => [...gs, goal]);
      setIcon("");
      setLabel("");
      setFrequency("daily");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeGoal(id) {
    const prev = goals;
    setGoals((gs) => gs.filter((g) => g.id !== id));
    try {
      await api.deleteGoal(id);
    } catch (e) {
      setError(e.message);
      setGoals(prev);
    }
  }

  const daily = (goals || []).filter((g) => g.frequency === "daily");
  const weekly = (goals || []).filter((g) => g.frequency === "weekly");
  const total = (goals || []).length;
  const done = (goals || []).filter((g) => g.completed).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-title">
          <h1>Goals</h1>
          <span className="subtitle">{TODAY_LABEL}</span>
        </div>
        <div className="topbar-actions">
          <Link to="/stats" className="btn-ghost">Stats</Link>
          <button className={`btn-ghost ${manage ? "active" : ""}`} onClick={() => setManage((m) => !m)}>
            {manage ? "Done" : "Manage"}
          </button>
          <button className="btn-ghost" onClick={handleSignOut} title={getEmail() || ""}>Sign out</button>
        </div>
      </header>

      {error && <p className="banner error">{error}</p>}

      {goals === null && <p className="muted center">Loading…</p>}

      {goals && (
        <>
          {!manage && total > 0 && (
            <section className="progress-card">
              <div className="progress-head">
                <span className="progress-count">{done} / {total}</span>
                <span className="muted">completed</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              {allDone && <p className="celebrate">🎉 All done — nice work!</p>}
            </section>
          )}

          <GoalSection title="Daily" goals={daily} manage={manage} onToggle={toggle} onRemove={removeGoal} />
          <GoalSection title="Weekly" goals={weekly} manage={manage} onToggle={toggle} onRemove={removeGoal} />

          {total === 0 && !manage && (
            <p className="empty">No goals yet. Tap <strong>Manage</strong> to add one.</p>
          )}

          {manage && (
            <form className="add-card" onSubmit={addGoal}>
              <h3>Add a goal</h3>
              <div className="add-row">
                <input
                  className="emoji-input"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="🎯"
                  maxLength={4}
                  aria-label="Emoji"
                />
                <input
                  className="label-input"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Goal name"
                  aria-label="Goal name"
                />
              </div>
              <div className="freq-toggle">
                <label className={frequency === "daily" ? "active" : ""}>
                  <input type="radio" name="freq" value="daily" checked={frequency === "daily"} onChange={() => setFrequency("daily")} />
                  Daily
                </label>
                <label className={frequency === "weekly" ? "active" : ""}>
                  <input type="radio" name="freq" value="weekly" checked={frequency === "weekly"} onChange={() => setFrequency("weekly")} />
                  Weekly
                </label>
              </div>
              <button type="submit" className="btn-primary" disabled={!label.trim() || busy}>
                {busy ? "Adding…" : "Add goal"}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

function GoalSection({ title, goals, manage, onToggle, onRemove }) {
  if (!goals.length) return null;
  return (
    <section className="goal-section">
      <h2 className="section-title">{title}</h2>
      <ul className="goal-list">
        {goals.map((g) => (
          <li key={g.id} className={`goal-item ${g.completed ? "done" : ""}`}>
            <span className="goal-icon">{g.icon}</span>
            <span className="goal-label">{g.label}</span>
            {manage ? (
              <button className="btn-delete" onClick={() => onRemove(g.id)} aria-label={`Delete ${g.label}`}>✕</button>
            ) : (
              <button
                className={`check ${g.completed ? "checked" : ""}`}
                onClick={() => onToggle(g.id)}
                aria-label={g.completed ? "Mark incomplete" : "Mark complete"}
              >
                {g.completed ? "✓" : ""}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
