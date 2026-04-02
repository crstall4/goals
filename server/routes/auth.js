import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db, { seedDefaultGoals } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/',
  secure: process.env.NODE_ENV === 'production',
};

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)'
    ).run(username, hash);
    seedDefaultGoals(result.lastInsertRowid);
    const token = signToken({ id: result.lastInsertRowid, username });
    res.cookie('token', token, COOKIE_OPTS).json({ username });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken({ id: user.id, username: user.username });
  res.cookie('token', token, COOKIE_OPTS).json({ username: user.username });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token', { path: '/' }).json({ ok: true });
});

export default router;
