import express from 'express';
import cron from 'node-cron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import db from './db.js';
import authRoutes from './routes/auth.js';
import goalRoutes from './routes/goals.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '../dist');

const app = express();
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/goals', goalRoutes);

// Serve the built frontend in production
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((_req, res) => res.sendFile(join(distDir, 'index.html')));
}

// 3:30 AM MST (10:30 AM UTC) — backfill daily goals for the just-completed day
cron.schedule('30 10 * * *', () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const date = d.toISOString().slice(0, 10);

  const dailyGoals = db.prepare("SELECT id, user_id FROM goals WHERE frequency = 'daily'").all();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO goal_completions (user_id, goal_id, date, completed)
    VALUES (?, ?, ?, 0)
  `);
  for (const goal of dailyGoals) {
    insert.run(goal.user_id, goal.id, date);
  }
  console.log(`[cron] Archived ${dailyGoals.length} daily goals for ${date}`);
});

// Saturday 11:59 PM — backfill weekly goals for this week (keyed by today = Saturday)
cron.schedule('59 23 * * 6', () => {
  const date = new Date().toISOString().slice(0, 10);

  const weeklyGoals = db.prepare("SELECT id, user_id FROM goals WHERE frequency = 'weekly'").all();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO goal_completions (user_id, goal_id, date, completed)
    VALUES (?, ?, ?, 0)
  `);
  for (const goal of weeklyGoals) {
    insert.run(goal.user_id, goal.id, date);
  }
  console.log(`[cron] Archived ${weeklyGoals.length} weekly goals for week ending ${date}`);
});

const PORT = process.env.PORT || 3101;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
