import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function currentWeekSaturday() {
  const d = new Date();
  const daysUntilSat = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + daysUntilSat);
  return d.toISOString().slice(0, 10);
}

function periodDate(frequency) {
  return frequency === 'weekly' ? currentWeekSaturday() : todayDate();
}

// Add n days to a YYYY-MM-DD string using UTC math (avoids DST issues)
function shiftDate(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function calcStreak(completionMap, frequency, today, saturday) {
  let streak = 0;
  if (frequency === 'daily') {
    let date = completionMap.get(today) ? today : shiftDate(today, -1);
    for (let i = 0; i < 365; i++) {
      if (!completionMap.get(date)) break;
      streak++;
      date = shiftDate(date, -1);
    }
  } else {
    // weekly: walk back through past Saturdays
    let date = completionMap.get(saturday) ? saturday : shiftDate(saturday, -7);
    for (let i = 0; i < 52; i++) {
      if (!completionMap.get(date)) break;
      streak++;
      date = shiftDate(date, -7);
    }
  }
  return streak;
}

// GET /api/goals — all goals with current completion status
router.get('/', requireAuth, (req, res) => {
  const today = todayDate();
  const saturday = currentWeekSaturday();

  const goals = db.prepare(`
    SELECT g.id, g.label, g.icon, g.frequency,
           COALESCE(gc.completed, 0) AS completed
    FROM goals g
    LEFT JOIN goal_completions gc
      ON gc.goal_id = g.id
      AND gc.date = CASE WHEN g.frequency = 'daily' THEN ? ELSE ? END
    WHERE g.user_id = ?
    ORDER BY g.sort_order, g.id
  `).all(today, saturday, req.user.id);

  res.json(goals.map(g => ({ ...g, completed: g.completed === 1 })));
});

// POST /api/goals — create a goal
router.post('/', requireAuth, (req, res) => {
  const { label, icon = '🎯', frequency = 'daily' } = req.body;
  if (!label?.trim()) {
    return res.status(400).json({ error: 'Label required' });
  }
  if (!['daily', 'weekly'].includes(frequency)) {
    return res.status(400).json({ error: 'frequency must be daily or weekly' });
  }
  const result = db.prepare(
    'INSERT INTO goals (user_id, label, icon, frequency) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, label.trim(), icon.trim() || '🎯', frequency);

  res.json({ id: result.lastInsertRowid, label: label.trim(), icon: icon.trim() || '🎯', frequency, completed: false });
});

// DELETE /api/goals/:id
router.delete('/:id', requireAuth, (req, res) => {
  const goal = db.prepare('SELECT id FROM goals WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  db.prepare('DELETE FROM goals WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// PUT /api/goals/:id/toggle
router.put('/:id/toggle', requireAuth, (req, res) => {
  const goal = db.prepare('SELECT id, frequency FROM goals WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });

  const date = periodDate(goal.frequency);
  const existing = db.prepare(
    'SELECT completed FROM goal_completions WHERE user_id = ? AND goal_id = ? AND date = ?'
  ).get(req.user.id, goal.id, date);

  const newValue = existing ? (existing.completed ? 0 : 1) : 1;
  db.prepare(`
    INSERT INTO goal_completions (user_id, goal_id, date, completed)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, goal_id, date) DO UPDATE SET completed = excluded.completed
  `).run(req.user.id, goal.id, date, newValue);

  res.json({ completed: newValue === 1 });
});

// GET /api/goals/stats — goals with current streak
router.get('/stats', requireAuth, (req, res) => {
  const today = todayDate();
  const saturday = currentWeekSaturday();

  const goals = db.prepare(`
    SELECT id, label, icon, frequency FROM goals
    WHERE user_id = ? ORDER BY sort_order, id
  `).all(req.user.id);

  const completions = db.prepare(`
    SELECT goal_id, date, completed FROM goal_completions
    WHERE user_id = ? AND completed = 1
  `).all(req.user.id);

  // Group completed dates by goal
  const byGoal = {};
  completions.forEach(c => {
    if (!byGoal[c.goal_id]) byGoal[c.goal_id] = new Map();
    byGoal[c.goal_id].set(c.date, true);
  });

  res.json(goals.map(g => ({
    ...g,
    streak: calcStreak(byGoal[g.id] || new Map(), g.frequency, today, saturday),
  })));
});

// GET /api/goals/history
router.get('/history', requireAuth, (req, res) => {
  const today = todayDate();
  const thisSat = currentWeekSaturday();

  const rows = db.prepare(`
    SELECT gc.date, gc.completed, g.id AS goal_id, g.label, g.icon, g.frequency
    FROM goal_completions gc
    JOIN goals g ON g.id = gc.goal_id
    WHERE gc.user_id = ?
      AND (
        (g.frequency = 'daily'  AND gc.date < ?)
        OR
        (g.frequency = 'weekly' AND gc.date < ?)
      )
    ORDER BY gc.date DESC
  `).all(req.user.id, today, thisSat);

  const dailyMap = {};
  const weeklyMap = {};

  rows.forEach(r => {
    const entry = { id: r.goal_id, label: r.label, icon: r.icon, completed: r.completed === 1 };
    if (r.frequency === 'daily') {
      if (!dailyMap[r.date]) dailyMap[r.date] = [];
      dailyMap[r.date].push(entry);
    } else {
      if (!weeklyMap[r.date]) weeklyMap[r.date] = [];
      weeklyMap[r.date].push(entry);
    }
  });

  const daily = Object.entries(dailyMap)
    .map(([date, goals]) => ({ date, goals }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const weekly = Object.entries(weeklyMap)
    .map(([weekEnding, goals]) => ({ weekEnding, goals }))
    .sort((a, b) => b.weekEnding.localeCompare(a.weekEnding));

  res.json({ daily, weekly });
});

export default router;
