import { Navigate, Route, Routes } from "react-router-dom";
import { isSignedIn } from "./lib/auth.js";
import Login from "./routes/Login.jsx";
import Dashboard from "./routes/Dashboard.jsx";
import Stats from "./routes/Stats.jsx";

function RequireAuth({ children }) {
  return isSignedIn() ? children : <Navigate to="/login" replace />;
}

function RedirectIfSignedIn({ children }) {
  return isSignedIn() ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfSignedIn>
            <Login />
          </RedirectIfSignedIn>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/stats"
        element={<Stats />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
