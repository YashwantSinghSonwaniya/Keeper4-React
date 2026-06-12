import React, { useState } from "react";
import { Link, useHistory } from "react-router-dom";
import { registerUser, googleAuth } from "../api";
import { useGoogleLogin } from "@react-oauth/google";

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
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // ✅ Google OAuth — same endpoint handles sign-up and sign-in automatically
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

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const res = await registerUser(form);

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

        {/* ✅ Google button now triggers the OAuth popup */}
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