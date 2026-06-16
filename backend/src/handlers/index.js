import * as db from "../lib/dynamo.js";
import {
  todayDate,
  currentWeekSaturday,
  periodDate,
  shiftDate,
  calcStreak,
} from "../lib/time.js";

const HISTORY_DAYS = 30; // how far back the daily history shows
const HISTORY_WEEKS = 12; // how far back the weekly history shows

export async function getMe(ctx) {
  return { userId: ctx.userId, email: ctx.email };
}

// GET /goals — all goals with completion status for the current period.
// Seeds the default goal set on first-ever use.
export async function getGoals(ctx) {
  let goals = await db.listGoals(ctx.userId);
  if (goals.length === 0) {
    goals = await db.seedDefaultGoals(ctx.userId);
  }

  const completed = await completedSet(ctx.userId);
  const today = todayDate();
  const saturday = currentWeekSaturday();

  return {
    goals: goals.map((g) => ({
      id: g.goalId,
      label: g.label,
      icon: g.icon,
      frequency: g.frequency,
      completed: completed.has(key(g.frequency === "weekly" ? saturday : today, g.goalId)),
    })),
  };
}

// POST /goals — create a goal. { label, icon?, frequency? }
export async function postGoal(ctx) {
  const { label, icon = "🎯", frequency = "daily" } = ctx.body || {};
  if (!label || typeof label !== "string" || !label.trim()) {
    return { statusCode: 400, body: { error: "label required" } };
  }
  if (!["daily", "weekly"].includes(frequency)) {
    return { statusCode: 400, body: { error: "frequency must be daily or weekly" } };
  }
  const cleanIcon = (typeof icon === "string" && icon.trim()) || "🎯";
  const g = await db.createGoal(ctx.userId, { label: label.trim(), icon: cleanIcon, frequency });
  return { goal: { id: g.goalId, label: g.label, icon: g.icon, frequency: g.frequency, completed: false } };
}

// POST /goals/delete — { id }
export async function postGoalDelete(ctx) {
  const { id } = ctx.body || {};
  if (!id) return { statusCode: 400, body: { error: "id required" } };
  await db.deleteGoal(ctx.userId, id);
  return { ok: true };
}

// POST /goals/toggle — { id }. Flips completion for the current period.
export async function postGoalToggle(ctx) {
  const { id } = ctx.body || {};
  if (!id) return { statusCode: 400, body: { error: "id required" } };

  const goals = await db.listGoals(ctx.userId);
  const goal = goals.find((g) => g.goalId === id);
  if (!goal) return { statusCode: 404, body: { error: "goal not found" } };

  const date = periodDate(goal.frequency);
  const completed = await completedSet(ctx.userId);
  const next = !completed.has(key(date, id));
  await db.setCompletion(ctx.userId, id, date, next);
  return { completed: next };
}

// GET /goals/stats — each goal with its current streak.
export async function getStats(ctx) {
  const goals = await db.listGoals(ctx.userId);
  const comps = await db.listCompletions(ctx.userId);
  const today = todayDate();
  const saturday = currentWeekSaturday();

  const datesByGoal = new Map();
  for (const c of comps) {
    if (!c.completed) continue;
    if (!datesByGoal.has(c.goalId)) datesByGoal.set(c.goalId, new Set());
    datesByGoal.get(c.goalId).add(c.date);
  }

  return {
    goals: goals.map((g) => ({
      id: g.goalId,
      label: g.label,
      icon: g.icon,
      frequency: g.frequency,
      streak: calcStreak(datesByGoal.get(g.goalId) || new Set(), g.frequency, today, saturday),
    })),
  };
}

// GET /goals/history — past periods with per-goal completed/missed status.
// Misses are inferred (we only store completions), and each goal only appears
// for periods on/after it was created.
export async function getHistory(ctx) {
  const goals = await db.listAllGoals(ctx.userId);
  const completed = await completedSet(ctx.userId);

  const dailyGoals = goals.filter((g) => g.frequency === "daily");
  const weeklyGoals = goals.filter((g) => g.frequency === "weekly");

  const today = todayDate();
  const thisSat = currentWeekSaturday();

  // Daily: yesterday back HISTORY_DAYS days.
  const daily = [];
  for (let i = 1; i <= HISTORY_DAYS; i++) {
    const date = shiftDate(today, -i);
    const entries = dailyGoals
      .filter((g) => date >= dailyStart(g.createdAt) && (!g.deletedAt || date < deletedDate(g.deletedAt)))
      .map((g) => goalEntry(g, completed.has(key(date, g.goalId))));
    if (entries.length) daily.push({ date, goals: entries });
  }

  // Weekly: last completed Saturday back HISTORY_WEEKS weeks.
  const weekly = [];
  for (let i = 1; i <= HISTORY_WEEKS; i++) {
    const weekEnding = shiftDate(thisSat, -7 * i);
    const entries = weeklyGoals
      .filter((g) => weekEnding >= weeklyStart(g.createdAt) && (!g.deletedAt || weekEnding < deletedDate(g.deletedAt)))
      .map((g) => goalEntry(g, completed.has(key(weekEnding, g.goalId))));
    if (entries.length) weekly.push({ weekEnding, goals: entries });
  }

  return { daily, weekly };
}

// ----- helpers ------------------------------------------------------------

const key = (date, goalId) => `${date}#${goalId}`;

async function completedSet(userId) {
  const comps = await db.listCompletions(userId);
  const set = new Set();
  for (const c of comps) if (c.completed) set.add(key(c.date, c.goalId));
  return set;
}

function goalEntry(g, completed) {
  return { id: g.goalId, label: g.label, icon: g.icon, completed };
}

// The daily-period date a goal was created in (same 3:30 AM MST offset).
function dailyStart(createdAt) {
  const d = new Date((createdAt || 0) - 10.5 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// The daily-period date a goal was deleted in (same 3:30 AM MST offset).
function deletedDate(deletedAt) {
  const d = new Date(deletedAt - 10.5 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// The week-ending Saturday of the week a goal was created in.
function weeklyStart(createdAt) {
  const d = new Date(createdAt || 0);
  const daysUntilSat = (6 - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + daysUntilSat);
  return d.toISOString().slice(0, 10);
}
