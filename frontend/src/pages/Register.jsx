import React, { useState } from "react";
import { Link, useHistory } from "react-router-dom";
import { registerUser } from "../api";

function Register({ onLogin }) {
  const [loading, setLoading] = useState(false);
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

      // ✅ Save token and user to localStorage
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

        <button type="button" className="google-btn">
          <img src="/images/google-icon.jpg" alt="Google logo" />
          Continue with Google
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