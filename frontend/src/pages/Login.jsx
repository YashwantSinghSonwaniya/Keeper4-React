import React, { useState } from "react";
import { Link, useHistory } from "react-router-dom";
import { loginUser, googleAuth } from "../api";
import { useGoogleLogin } from "@react-oauth/google";

// ─────────────────────────────────────────────────────────────────────────────
// Client-side email validator — mirrors the backend rules exactly so the user
// gets instant feedback without a round trip.
// ─────────────────────────────────────────────────────────────────────────────
function isValidEmailFormat(email) {
  if (!email || typeof email !== "string") return false;
  if (/\s/.test(email)) return false;

  const segments = email.split("@");
  if (segments.length !== 2) return false;

  const [local, domain] = segments;
  if (!local.length || !domain.length) return false;

  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (local.length > 64) return false;
  if (!/^[a-zA-Z0-9._%+\-!#$&'*/=?^`{|}~]+$/.test(local)) return false;

  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((l) => l.length === 0)) return false;
  const tld = labels[labels.length - 1];
  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return false;
  if (domain.length > 255) return false;
  if (!/^[a-zA-Z0-9.-]+$/.test(domain)) return false;

  return true;
}

function Login({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const history = useHistory();

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      // Lowercase the email as the user types — avoids surprises on submit
      [name]: name === "email" ? value.toLowerCase() : value,
    }));
  }

  // ✅ Google OAuth — triggers popup, receives one-time auth code
  const handleGoogleLogin = useGoogleLogin({
    flow: "auth-code",
    onSuccess: async (codeResponse) => {
      setGoogleLoading(true);
      setError("");
      try {
        const res = await googleAuth({ code: codeResponse.code });

        localStorage.setItem("token", res.data.token);
        localStorage.setItem("loggedInUser", JSON.stringify(res.data.user));

        const userKey = res.data.user.id
          ? `user_${res.data.user.id}`
          : `user_${encodeURIComponent(res.data.user.email || "unknown")}`;
        sessionStorage.setItem(`guestImportPromptPending_${userKey}`, "true");
        sessionStorage.setItem(`guestImportPromptHandled_${userKey}`, "false");

        onLogin(res.data.user);
        history.push("/");
      } catch (err) {
        setError(err.response?.data?.error || "Google login failed. Please try again.");
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      setError("Google login was cancelled or failed. Please try again.");
    },
  });

  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    // ── Normalize before sending ──────────────────────────────────────
    const normalizedEmail = form.email.trim().toLowerCase();

    // ── Client-side format validation (instant feedback, no round trip) ─
    if (!isValidEmailFormat(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await loginUser({
        email: normalizedEmail,
        password: form.password,
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("loggedInUser", JSON.stringify(res.data.user));

      const userKey = res.data.user.id
        ? `user_${res.data.user.id}`
        : `user_${encodeURIComponent(res.data.user.email || "unknown")}`;
      sessionStorage.setItem(`guestImportPromptPending_${userKey}`, "true");
      sessionStorage.setItem(`guestImportPromptHandled_${userKey}`, "false");

      onLogin(res.data.user);
      history.push("/");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed.");
      setLoading(false);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setForgotMsg("");

    // Client-side email format check for instant feedback
    const normalizedEmail = forgotEmail.trim().toLowerCase();
    if (!isValidEmailFormat(normalizedEmail)) {
      setForgotMsg("Please enter a valid email address.");
      return;
    }

    setForgotLoading(true);
    try {
      const { forgotPassword } = await import("../api");
      await forgotPassword({ email: normalizedEmail });
      // Always show the generic message returned by the backend. We do NOT
      // reveal whether the email exists (prevents account enumeration).
      setForgotMsg(
        "If this email exists, a reset link has been sent. Please check your inbox (and spam folder).",
      );
    } catch (err) {
      // Only true server/network errors reach here now.
      setForgotMsg(
        err.response?.data?.error ||
          "Something went wrong. Please try again later.",
      );
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Welcome Back</h2>

        <button
          type="button"
          className="google-btn"
          onClick={() => handleGoogleLogin()}
          disabled={googleLoading}
        >
          <img src="/images/google-icon.jpg" alt="Google logo" />
          {googleLoading ? "Connecting..." : "Continue with Google"}
        </button>

        <div className="divider">
          <span>OR</span>
        </div>

        {!showForgot ? (
          <>
            <form onSubmit={handleLogin}>
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={form.email}
                onChange={handleChange}
                required
              />
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                required
              />

              {error && <p className="error">{error}</p>}

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>

            <p
              className="forgot-password-link"
              onClick={() => setShowForgot(true)}
            >
              Forgot password?
            </p>

            <p>
              Don't have an account? <Link to="/register">Register</Link>
            </p>
          </>
        ) : (
          <>
            <form onSubmit={handleForgotPassword}>
              <p className="forgot-title">Reset your password</p>
              <input
                type="email"
                placeholder="Enter your email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value.toLowerCase())}
                required
              />

              {forgotMsg && <p className="forgot-msg">{forgotMsg}</p>}

              <button type="submit" className="auth-btn" disabled={forgotLoading}>
                {forgotLoading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>

            <p
              className="forgot-password-link"
              onClick={() => {
                setShowForgot(false);
                setForgotMsg("");
                setForgotEmail("");
              }}
            >
              ← Back to login
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default Login;