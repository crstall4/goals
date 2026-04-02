import { useState, useEffect } from 'react';
import GoalItem from '../components/GoalItem';
import { api } from '../api';
import styles from './Dashboard.module.css';

export default function Dashboard({ user, onLogout, onShowStats }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [managing, setManaging] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('🎯');
  const [newFreq, setNewFreq] = useState('daily');
  const [addError, setAddError] = useState('');

  useEffect(() => {
    api.getGoals()
      .then(setGoals)
      .catch(() => onLogout())
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(id) {
    const { completed } = await api.toggleGoal(id);
    setGoals(prev => prev.map(g => g.id === id ? { ...g, completed } : g));
  }

  async function handleDelete(id) {
    await api.deleteGoal(id);
    setGoals(prev => prev.filter(g => g.id !== id));
  }

  async function handleAdd(e) {
    e.preventDefault();
    setAddError('');
    try {
      const goal = await api.createGoal(newLabel, newIcon, newFreq);
      setGoals(prev => [...prev, goal]);
      setNewLabel('');
      setNewIcon('🎯');
      setNewFreq('daily');
    } catch (err) {
      setAddError(err.message);
    }
  }

  const dailyGoals = goals.filter(g => g.frequency === 'daily');
  const weeklyGoals = goals.filter(g => g.frequency === 'weekly');
  const completedCount = goals.filter(g => g.completed).length;
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Daily Goals</h1>
          <p className={styles.date}>{today}</p>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.userEmail}>{user.username}</span>
          <button className={styles.historyBtn} onClick={onShowStats}>Stats</button>
          <button
            className={`${styles.manageBtn} ${managing ? styles.manageBtnActive : ''}`}
            onClick={() => setManaging(m => !m)}
          >
            {managing ? 'Done' : 'Manage'}
          </button>
          <button className={styles.logoutBtn} onClick={onLogout}>Sign Out</button>
        </div>
      </header>

      <main className={styles.main}>
        {loading ? (
          <p className={styles.loadingText}>Loading...</p>
        ) : (
          <>
            {!managing && goals.length > 0 && (
              <div className={styles.progress}>
                <span className={styles.progressText}>
                  {completedCount} / {goals.length} completed
                </span>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${(completedCount / goals.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {dailyGoals.length > 0 && (
              <section>
                {weeklyGoals.length > 0 && (
                  <p className={styles.sectionLabel}>Daily</p>
                )}
                <div className={styles.goalList}>
                  {dailyGoals.map(goal => (
                    <div key={goal.id} className={managing ? styles.manageRow : ''}>
                      <GoalItem
                        id={goal.id}
                        label={goal.label}
                        icon={goal.icon}
                        frequency={goal.frequency}
                        checked={goal.completed}
                        onChange={() => handleToggle(goal.id)}
                      />
                      {managing && (
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDelete(goal.id)}
                          title="Delete goal"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {weeklyGoals.length > 0 && (
              <section>
                <p className={styles.sectionLabel}>Weekly</p>
                <div className={styles.goalList}>
                  {weeklyGoals.map(goal => (
                    <div key={goal.id} className={managing ? styles.manageRow : ''}>
                      <GoalItem
                        id={goal.id}
                        label={goal.label}
                        icon={goal.icon}
                        frequency={goal.frequency}
                        checked={goal.completed}
                        onChange={() => handleToggle(goal.id)}
                      />
                      {managing && (
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDelete(goal.id)}
                          title="Delete goal"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {goals.length === 0 && !managing && (
              <p className={styles.loadingText}>No goals yet — click Manage to add some.</p>
            )}

            {!managing && completedCount === goals.length && goals.length > 0 && (
              <p className={styles.allDone}>All done for today!</p>
            )}

            {managing && (
              <form onSubmit={handleAdd} className={styles.addForm}>
                <p className={styles.addFormTitle}>Add a goal</p>
                <div className={styles.addRow}>
                  <input
                    className={`${styles.addInput} ${styles.addIcon}`}
                    value={newIcon}
                    onChange={e => setNewIcon(e.target.value)}
                    placeholder="🎯"
                    maxLength={4}
                  />
                  <input
                    className={`${styles.addInput} ${styles.addLabel}`}
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    placeholder="Goal name"
                    required
                  />
                  <label className={styles.freqToggle}>
                    <input
                      type="radio"
                      name="freq"
                      value="daily"
                      checked={newFreq === 'daily'}
                      onChange={() => setNewFreq('daily')}
                    />
                    Daily
                  </label>
                  <label className={styles.freqToggle}>
                    <input
                      type="radio"
                      name="freq"
                      value="weekly"
                      checked={newFreq === 'weekly'}
                      onChange={() => setNewFreq('weekly')}
                    />
                    Weekly
                  </label>
                  <button type="submit" className={styles.addBtn}>Add</button>
                </div>
                {addError && <p className={styles.addError}>{addError}</p>}
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
}
