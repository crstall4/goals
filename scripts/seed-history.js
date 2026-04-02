import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { seedDefaultGoals } from '../server/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '../goals.db'));

const USERNAME = 'clayton';
const PASSWORD = 'password';
const DAYS_BACK = 30;

// Ensure user exists
let user = db.prepare('SELECT id FROM users WHERE username = ?').get(USERNAME);
if (!user) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)'
  ).run(USERNAME, hash);
  user = { id: result.lastInsertRowid };
  seedDefaultGoals(user.id);
  console.log(`Created user "${USERNAME}" with password "${PASSWORD}"`);
} else {
  console.log(`User "${USERNAME}" already exists, seeding history...`);
}

// Get this user's goals
const goals = db.prepare('SELECT id, frequency FROM goals WHERE user_id = ?').all(user.id);
if (goals.length === 0) {
  console.log('No goals found for this user. Run the app and register to seed default goals first.');
  process.exit(1);
}

const dailyGoals  = goals.filter(g => g.frequency === 'daily');
const weeklyGoals = goals.filter(g => g.frequency === 'weekly');

const insert = db.prepare(`
  INSERT OR REPLACE INTO goal_completions (user_id, goal_id, date, completed)
  VALUES (?, ?, ?, ?)
`);

// Seed daily goals — one entry per day
for (let i = DAYS_BACK; i >= 1; i--) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  const date = d.toISOString().slice(0, 10);

  for (const goal of dailyGoals) {
    insert.run(user.id, goal.id, date, Math.random() > 0.3 ? 1 : 0);
  }
}

// Seed weekly goals — one entry per past Saturday
const pastSaturdays = [];
{
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
  const daysToLastSat = dayOfWeek === 6 ? 7 : dayOfWeek + 1;
  for (let w = 1; w <= 4; w++) {
    const sat = new Date(now);
    sat.setDate(now.getDate() - daysToLastSat - (w - 1) * 7);
    pastSaturdays.push(sat.toISOString().slice(0, 10));
  }
}

for (const date of pastSaturdays) {
  for (const goal of weeklyGoals) {
    insert.run(user.id, goal.id, date, Math.random() > 0.25 ? 1 : 0);
  }
}

console.log(`Seeded ${DAYS_BACK} days of daily history and ${pastSaturdays.length} weeks of weekly history for "${USERNAME}".`);
