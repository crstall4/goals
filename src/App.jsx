import { useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Stats from './pages/Stats';

function getUserFromStorage() {
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  if (token && username) return { username };
  return null;
}

export default function App() {
  const [user, setUser] = useState(getUserFromStorage);
  const [page, setPage] = useState('dashboard'); // 'dashboard' | 'stats'

  function handleLogin(userData) {
    setUser(userData);
    setPage('dashboard');
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUser(null);
    setPage('dashboard');
  }

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
