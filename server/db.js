import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '../goals.db'));

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS goals (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    label      TEXT NOT NULL,
    icon       TEXT NOT NULL DEFAULT '🎯',
    frequency  TEXT NOT NULL DEFAULT 'daily',
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS goal_completions (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL,
    goal_id   INTEGER NOT NULL,
    date      TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, goal_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE,
    FOREIGN KEY (goal_id) REFERENCES goals(id)  ON DELETE CASCADE
  );
`);

export const DEFAULT_GOALS = [
  { label: 'Read Scriptures', icon: '📖', frequency: 'daily' },
  { label: 'LeetCode Problem', icon: '💻', frequency: 'daily' },
  { label: 'Exercise',         icon: '🏋️', frequency: 'daily' },
];

export function seedDefaultGoals(userId) {
  const insert = db.prepare(
    'INSERT INTO goals (user_id, label, icon, frequency) VALUES (?, ?, ?, ?)'
  );
  for (const { label, icon, frequency } of DEFAULT_GOALS) {
    insert.run(userId, label, icon, frequency);
  }
}

export default db;
