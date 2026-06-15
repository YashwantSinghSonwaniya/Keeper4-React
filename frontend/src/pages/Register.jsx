import React, { useState } from "react";
import { Link } from "react-router-dom";
import { registerUser, googleAuth } from "../api";
import { useGoogleLogin } from "@react-oauth/google";
import { useHistory } from "react-router-dom";
import AuthNoticeModal from "../components/AuthNoticeModal";
import {
  EMAIL_REGISTRATION_NOTICE,
  EMAIL_SERVICES_UNAVAILABLE,
} from "../authServiceAvailability";

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
  if (local.startsWith(".") || local.endsWith(".") || local.includes(".."))
    return false;
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

// ─────────────────────────────────────────────────────────────────────────────
// Password validator — mirrors backend NIST 800-63B rules.
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
  const [submitted, setSubmitted] = useState(false); // ✅ "check your email" state
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [showEmailNotice, setShowEmailNotice] = useState(false);
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
      [name]: name === "email" ? value.toLowerCase() : value,
    }));
  }

  // ✅ Google OAuth — creates an auto-verified account and logs in immediately.
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
        setError(
          err.response?.data?.error ||
            "Google sign-up failed. Please try again.",
        );
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

    if (EMAIL_SERVICES_UNAVAILABLE) {
      setShowEmailNotice(true);
      return;
    }

    const trimmedName = form.name.trim();
    const normalizedEmail = form.email.trim().toLowerCase();

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

    const passwordError = validatePassword(form.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    try {
      // ✅ Phase 4: registration does NOT create a user or log in.
      // It stages a pending registration and sends a verification email.
      await registerUser({
        name: trimmedName,
        email: normalizedEmail,
        password: form.password,
      });

      setSubmittedEmail(normalizedEmail);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  // ✅ Confirmation screen — shown after a successful registration submit.
  if (submitted) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h2>Check Your Email</h2>
          <p className="forgot-msg">
            <span role="img" aria-label="email">
              📧
            </span>{" "}
            We've sent a verification link to <strong>{submittedEmail}</strong>.
          </p>
          <p style={{ fontSize: "14px", lineHeight: 1.5 }}>
            Please click the link in that email to activate your account. The
            link expires in 24 hours. Your account will not be created until you
            verify.
          </p>
          <p style={{ fontSize: "13px", color: "#5f6368", lineHeight: 1.5 }}>
            Didn't get it? Check your spam folder, or{" "}
            <span
              className="forgot-password-link"
              style={{ display: "inline" }}
              onClick={() => {
                setSubmitted(false);
                setForm({ name: "", email: "", password: "" });
              }}
            >
              try registering again
            </span>
            .
          </p>
          <p>
            Already verified? <Link to="/login">Login</Link>
          </p>
        </div>
      </div>
    );
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

        {EMAIL_SERVICES_UNAVAILABLE && (
          <p className="auth-inline-notice">
            Email registration is temporarily unavailable. Please use Google
            Sign-In.
          </p>
        )}

        <form
          onSubmit={handleRegister}
          noValidate={EMAIL_SERVICES_UNAVAILABLE}
        >
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
          <p className="password-hint">
            Use 8–128 characters. No special characters required.
          </p>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Sending verification..." : "Register"}
          </button>
        </form>

        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>

      <AuthNoticeModal
        open={showEmailNotice}
        title={EMAIL_REGISTRATION_NOTICE.title}
        message={EMAIL_REGISTRATION_NOTICE.message}
        onPrimary={() => {
          setShowEmailNotice(false);
          handleGoogleRegister();
        }}
        onClose={() => setShowEmailNotice(false)}
        primaryLoading={googleLoading}
      />
    </div>
  );
}

export default Register;
