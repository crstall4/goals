import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { confirmSignUp, resendConfirmation, signIn, signUp } from "../lib/auth.js";

function friendly(err) {
  const m = err?.message || String(err);
  if (m.includes("UserNotConfirmedException")) return "Please confirm your email first.";
  if (m.includes("NotAuthorized")) return "Incorrect email or password.";
  if (m.includes("UsernameExists")) return "That email is already registered.";
  if (m.includes("InvalidPassword")) return "Password must be 8+ chars with upper, lower, and a number.";
  if (m.includes("CodeMismatch")) return "Wrong code. Check the email and try again.";
  if (m.includes("ExpiredCode")) return "That code expired — request a new one.";
  return m;
}

export default function Login() {
  const navigate = useNavigate();
  // tab: "signin" | "signup" | "confirm"
  const [tab, setTab] = useState("signin");
  const [pendingEmail, setPendingEmail] = useState("");
  const [msg, setMsg] = useState({ text: "", kind: "" });

  function switchTab(t) {
    setTab(t);
    setMsg({ text: "", kind: "" });
  }

  async function handleSignIn(e) {
    e.preventDefault();
    setMsg({ text: "Signing in…", kind: "" });
    const f = new FormData(e.currentTarget);
    try {
      await signIn(f.get("email").trim(), f.get("password"));
      navigate("/", { replace: true });
    } catch (err) {
      setMsg({ text: friendly(err), kind: "error" });
    }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setMsg({ text: "Creating account…", kind: "" });
    const f = new FormData(e.currentTarget);
    const email = f.get("email").trim();
    try {
      await signUp(email, f.get("password"));
      setPendingEmail(email);
      setTab("confirm");
      setMsg({ text: "", kind: "" });
    } catch (err) {
      setMsg({ text: friendly(err), kind: "error" });
    }
  }

  async function handleConfirm(e) {
    e.preventDefault();
    setMsg({ text: "Confirming…", kind: "" });
    const code = new FormData(e.currentTarget).get("code").trim();
    try {
      await confirmSignUp(pendingEmail, code);
      setMsg({ text: "Confirmed! Sign in below.", kind: "ok" });
      setTimeout(() => switchTab("signin"), 800);
    } catch (err) {
      setMsg({ text: friendly(err), kind: "error" });
    }
  }

  async function handleResend() {
    try {
      await resendConfirmation(pendingEmail);
      setMsg({ text: "New code sent — check your inbox.", kind: "ok" });
    } catch (err) {
      setMsg({ text: friendly(err), kind: "error" });
    }
  }

  return (
    <div className="auth-shell">
      <main className="auth-card">
        <div className="brand">
          <span className="brand-mark">◎</span>
          <span className="brand-name">Goals</span>
        </div>
        <p className="brand-tag">Small wins, every day.</p>

        {tab !== "confirm" && (
          <div className="tabs">
            <button className={`tab ${tab === "signin" ? "active" : ""}`} onClick={() => switchTab("signin")}>
              Sign in
            </button>
            <button className={`tab ${tab === "signup" ? "active" : ""}`} onClick={() => switchTab("signup")}>
              Sign up
            </button>
          </div>
        )}

        {tab === "signin" && (
          <form className="auth-form" onSubmit={handleSignIn}>
            <label>
              Email
              <input type="email" name="email" autoComplete="email" required defaultValue={pendingEmail} />
            </label>
            <label>
              Password
              <input type="password" name="password" autoComplete="current-password" required />
            </label>
            <button type="submit" className="btn-primary">Sign in</button>
            {msg.text && <p className={`msg ${msg.kind}`}>{msg.text}</p>}
          </form>
        )}

        {tab === "signup" && (
          <form className="auth-form" onSubmit={handleSignUp}>
            <label>
              Email
              <input type="email" name="email" autoComplete="email" required />
            </label>
            <label>
              Password
              <input type="password" name="password" autoComplete="new-password" minLength={8} required />
              <span className="hint">8+ characters, with upper, lower, and a number.</span>
            </label>
            <button type="submit" className="btn-primary">Create account</button>
            {msg.text && <p className={`msg ${msg.kind}`}>{msg.text}</p>}
          </form>
        )}

        {tab === "confirm" && (
          <form className="auth-form" onSubmit={handleConfirm}>
            <p className="confirm-lead">
              We sent a 6-digit code to <strong>{pendingEmail}</strong>.
            </p>
            <div className="notice">
              <strong>⚠ Check your spam / junk folder.</strong> The verification email comes from{" "}
              <code>no-reply@verificationemail.com</code> and often lands in spam the first time.
            </div>
            <label>
              Code
              <input type="text" name="code" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" required />
            </label>
            <button type="submit" className="btn-primary">Confirm</button>
            <div className="confirm-actions">
              <button type="button" className="btn-link" onClick={handleResend}>Resend code</button>
              <button type="button" className="btn-link" onClick={() => switchTab("signin")}>Back to sign in</button>
            </div>
            {msg.text && <p className={`msg ${msg.kind}`}>{msg.text}</p>}
          </form>
        )}
      </main>
    </div>
  );
}
