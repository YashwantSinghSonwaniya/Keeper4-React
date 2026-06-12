import React, { useState, useEffect } from "react";
import { Link, useHistory, useLocation } from "react-router-dom";
import { resetPassword } from "../api";

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

function ResetPassword() {
  const history = useHistory();
  const location = useLocation();

  const [token, setToken] = useState("");
  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // ── Extract the token from the URL query string on mount ─────────────
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      setToken(urlToken);
    } else {
      setError(
        "Missing reset token. Please use the link from your email or request a new one.",
      );
    }
  }, [location.search]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError(
        "Missing reset token. Please use the link from your email or request a new one.",
      );
      return;
    }

    // Client-side validation (instant feedback, mirrors backend)
    const passwordError = validatePassword(form.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);

    try {
      await resetPassword({ token, password: form.password });
      setSuccess(true);
      // Redirect to login after a short delay so the user reads the message
      setTimeout(() => {
        history.push("/login");
      }, 2500);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Could not reset password. The link may be invalid or expired.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Reset Password</h2>

        {success ? (
          <>
            <p className="forgot-msg">
              ✅ Your password has been reset successfully! Redirecting you to
              login...
            </p>
            <p>
              <Link to="/login">Go to login now</Link>
            </p>
          </>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <p className="forgot-title">Choose a new password</p>

              <input
                type="password"
                name="password"
                placeholder="New password"
                value={form.password}
                onChange={handleChange}
                required
              />
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm new password"
                value={form.confirmPassword}
                onChange={handleChange}
                required
              />

              <p className="password-hint">
                Use 8–128 characters. No special characters required.
              </p>

              {error && <p className="error">{error}</p>}

              <button
                type="submit"
                className="auth-btn"
                disabled={loading || !token}
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>

            <p className="forgot-password-link">
              <Link to="/login">← Back to login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default ResetPassword;