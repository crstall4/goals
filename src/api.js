const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  login:      (username, password) => request('POST', '/auth/login',    { username, password }),
  register:   (username, password) => request('POST', '/auth/register', { username, password }),

  getGoals:    ()                          => request('GET',    '/goals'),
  createGoal:  (label, icon, frequency)    => request('POST',   '/goals', { label, icon, frequency }),
  deleteGoal:  (id)                        => request('DELETE', `/goals/${id}`),
  toggleGoal:  (id)                        => request('PUT',    `/goals/${id}/toggle`),

  getStats:    ()                          => request('GET',    '/goals/stats'),
  getHistory:  ()                          => request('GET',    '/goals/history'),
};
