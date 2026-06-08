import React, { useState } from "react";
import { Link, useHistory } from "react-router-dom";
import { loginUser } from "../api";

function Login({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const history = useHistory();

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await loginUser(form);

      // ✅ Save token and user
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("loggedInUser", JSON.stringify(res.data.user));

      onLogin(res.data.user);
      history.push("/");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setForgotMsg("");

    try {
      const { forgotPassword } = await import("../api");
      await forgotPassword({ email: forgotEmail });
      setForgotMsg("If this email exists, a reset link has been sent.");
    } catch (err) {
      setForgotMsg(err.response?.data?.error || "Something went wrong.");
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Welcome Back</h2>

        <button type="button" className="google-btn">
          <img src="/images/google-icon.jpg" alt="Google logo" />
          Continue with Google
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

              <button
                type="submit"
                className="auth-btn"
                disabled={loading}
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>

            {/* ✅ Forgot password link */}
            <p
              className="forgot-password-link"
              onClick={() => setShowForgot(true)}
            >
              Forgot password?
            </p>

            <p>
              Don't have an account?{" "}
              <Link to="/register">Register</Link>
            </p>
          </>
        ) : (
          <>
            {/* ✅ Forgot password form */}
            <form onSubmit={handleForgotPassword}>
              <p className="forgot-title">Reset your password</p>
              <input
                type="email"
                placeholder="Enter your email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />

              {forgotMsg && (
                <p className="forgot-msg">{forgotMsg}</p>
              )}

              <button type="submit" className="auth-btn">
                Send Reset Link
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