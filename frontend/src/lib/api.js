// Authenticated fetch wrapper for the goals backend.

import { CONFIG } from "./config.js";
import { getIdToken, isSessionFresh, refreshSession, signOut } from "./auth.js";

async function authFetch(path, init = {}) {
  if (!isSessionFresh()) {
    try { await refreshSession(); } catch { signOut(); window.location.href = "/login"; return; }
  }
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${getIdToken()}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(`${CONFIG.apiUrl}${path}`, { ...init, headers });
  if (res.status === 401) {
    signOut();
    window.location.href = "/login";
    return;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getGoals: () => authFetch("/goals"),
  createGoal: (label, icon, frequency) =>
    authFetch("/goals", { method: "POST", body: JSON.stringify({ label, icon, frequency }) }),
  deleteGoal: (id) =>
    authFetch("/goals/delete", { method: "POST", body: JSON.stringify({ id }) }),
  toggleGoal: (id) =>
    authFetch("/goals/toggle", { method: "POST", body: JSON.stringify({ id }) }),
  getStats: () => authFetch("/goals/stats"),
  getHistory: () => authFetch("/goals/history"),
};
