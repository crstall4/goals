import { useState, useEffect } from 'react';
import { api } from '../api';
import styles from './History.module.css';

function formatDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const sat = new Date(y, m - 1, d);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() - 6);
  const fmt = { month: 'short', day: 'numeric' };
  return `${sun.toLocaleDateString('en-US', fmt)} – ${sat.toLocaleDateString('en-US', { ...fmt, year: 'numeric' })}`;
}

function DayRow({ label, goals }) {
  const completed = goals.filter(g => g.completed).length;
  const allDone = completed === goals.length;
  return (
    <div className={`${styles.row} ${allDone ? styles.rowAllDone : ''}`}>
      <div className={styles.rowDate}>{label}</div>
      <div className={styles.rowGoals}>
        {goals.map(g => (
          <span
            key={g.id}
            className={`${styles.badge} ${g.completed ? styles.badgeDone : styles.badgeMiss}`}
            title={g.label}
          >
            {g.icon}
          </span>
        ))}
      </div>
      <div className={styles.rowCount}>
        <span className={allDone ? styles.countDone : styles.countPartial}>
          {completed}/{goals.length}
        </span>
      </div>
    </div>
  );
}

export default function History({ user, onBack, onLogout }) {
  const [history, setHistory] = useState({ daily: [], weekly: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getHistory()
      .then(setHistory)
      .catch(() => onLogout())
      .finally(() => setLoading(false));
  }, []);

  const hasDaily = history.daily.length > 0;
  const hasWeekly = history.weekly.length > 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={onBack}>← Back</button>
          <div>
            <h1 className={styles.title}>History</h1>
            <p className={styles.subtitle}>{user.username}</p>
          </div>
        </div>
        <button className={styles.logoutBtn} onClick={onLogout}>Sign Out</button>
      </header>

      <main className={styles.main}>
        {loading && <p className={styles.empty}>Loading...</p>}

        {!loading && !hasDaily && !hasWeekly && (
          <p className={styles.empty}>No history yet — check back after your first day!</p>
        )}

        {!loading && hasDaily && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Daily Goals</h2>
            <div className={styles.list}>
              {history.daily.map(({ date, goals }) => (
                <DayRow key={date} label={formatDay(date)} goals={goals} />
              ))}
            </div>
          </section>
        )}

        {!loading && hasWeekly && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Weekly Goals</h2>
            <div className={styles.list}>
              {history.weekly.map(({ weekEnding, goals }) => (
                <DayRow key={weekEnding} label={formatWeek(weekEnding)} goals={goals} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
