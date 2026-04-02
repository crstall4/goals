import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Stats from './pages/Stats';
import { api } from './api';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState('dashboard');

  useEffect(() => {
    api.me()
      .then(data => setUser(data))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  function handleLogin(userData) {
    setUser(userData);
    setPage('dashboard');
  }

  async function handleLogout() {
    await api.logout().catch(() => {});
    localStorage.removeItem('username');
    setUser(null);
    setPage('dashboard');
  }

  if (checking) return null;

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (page === 'stats') {
    return <Stats user={user} onBack={() => setPage('dashboard')} onLogout={handleLogout} />;
  }

  return (
    <Dashboard
      user={user}
      onLogout={handleLogout}
      onShowStats={() => setPage('stats')}
    />
  );
}
