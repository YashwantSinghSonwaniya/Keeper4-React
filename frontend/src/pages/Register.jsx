import React, { useState } from "react";
import { Link, useHistory } from "react-router-dom";
import { registerUser, googleAuth } from "../api";
import { useGoogleLogin } from "@react-oauth/google";

// ─────────────────────────────────────────────────────────────────────────────
// Email validator — mirrors backend rules for instant client-side feedback.
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
  if (!/^[a-zA-Z0-9.\-]+$/.test(domain)) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Password validator — mirrors backend NIST 800-63B rules.
// Returns an error string if invalid, or null if valid.
// ─────────────────────────────────────────────────────────────────────────────
function validatePassword(password) {
  if (!password || password.trim().length === 0) {
    return "Password cannot be blank or contain only spaces.";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > 128) {
    return "Password must be 128 characters or fewer.";
  }
  return null;
}

function Register({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const history = useHistory();

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      // Lowercase email as the user types to prevent case-mismatch surprises
      [name]: name === "email" ? value.toLowerCase() : value,
    }));
  }

  // ✅ Google OAuth — same backend endpoint handles sign-up and sign-in
  const handleGoogleRegister = useGoogleLogin({
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
        setError(err.response?.data?.error || "Google sign-up failed. Please try again.");
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      setError("Google sign-up was cancelled or failed. Please try again.");
    },
  });

  async function handleRegister(e) {
    e.preventDefault();
    setError("");

    // ── Normalize before validation ───────────────────────────────────
    const trimmedName     = form.name.trim();
    const normalizedEmail = form.email.trim().toLowerCase();

    // ── Client-side validation (instant feedback, no server round trip) ─

    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (trimmedName.length > 100) {
      setError("Name must be 100 characters or fewer.");
      return;
    }

    if (!isValidEmailFormat(normalizedEmail)) {
      setError("Please enter a valid email address (e.g. user@example.com).");
      return;
    }

    // Phase 2: password validation
    const passwordError = validatePassword(form.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    try {
      const res = await registerUser({
        name: trimmedName,
        email: normalizedEmail,
        password: form.password,  // never trim passwords — spaces may be intentional
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
      setError(err.response?.data?.error || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Create Account</h2>

        <button
          type="button"
          className="google-btn"
          onClick={() => handleGoogleRegister()}
          disabled={googleLoading}
        >
          <img src="/images/google-icon.jpg" alt="Google logo" />
          {googleLoading ? "Connecting..." : "Continue with Google"}
        </button>

        <div className="divider">
          <span>OR</span>
        </div>

        <form onSubmit={handleRegister}>
          <input
            type="text"
            name="name"
            placeholder="Name"
            value={form.name}
            onChange={handleChange}
            required
          />
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
          {/* ✅ Phase 2: Password requirements hint */}
          <p className="password-hint">
            Use 8–128 characters. No special characters required.
          </p>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;