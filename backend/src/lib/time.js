// Date + streak helpers. Ported verbatim (behavior-wise) from the old
// Express server so the "current period" and streak math stay identical:
//
//   - The day rolls over at 3:30 AM MST (UTC-7) — we subtract 10.5 hours
//     from UTC before taking the date. Checking a goal at 1 AM still counts
//     for "yesterday".
//   - Weekly goals are keyed to the Saturday that ends the current week.
//   - Streaks walk backwards from the current period, stopping at the first
//     gap (daily up to 365 days, weekly up to 52 weeks).

export function todayDate() {
  const d = new Date(Date.now() - 10.5 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export function currentWeekSaturday() {
  const d = new Date();
  const daysUntilSat = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + daysUntilSat);
  return d.toISOString().slice(0, 10);
}

export function periodDate(frequency) {
  return frequency === "weekly" ? currentWeekSaturday() : todayDate();
}

// Add n days to a YYYY-MM-DD string using UTC math (avoids DST issues).
export function shiftDate(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

// completedDates: a Set of YYYY-MM-DD strings the goal was completed on.
export function calcStreak(completedDates, frequency, today, saturday) {
  let streak = 0;
  if (frequency === "daily") {
    let date = completedDates.has(today) ? today : shiftDate(today, -1);
    for (let i = 0; i < 365; i++) {
      if (!completedDates.has(date)) break;
      streak++;
      date = shiftDate(date, -1);
    }
  } else {
    let date = completedDates.has(saturday) ? saturday : shiftDate(saturday, -7);
    for (let i = 0; i < 52; i++) {
      if (!completedDates.has(date)) break;
      streak++;
      date = shiftDate(date, -7);
    }
  }
  return streak;
}
