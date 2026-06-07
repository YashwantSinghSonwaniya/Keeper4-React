import React, { useState } from "react";
import { Link, useHistory } from "react-router-dom";

function Login({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const history = useHistory();

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleLogin(e) {
    e.preventDefault();
    setError("");

    // Look up saved user
    const savedUser = localStorage.getItem("registeredUser");

    if (!savedUser) {
      setError("No account found. Please register first.");
      return;
    }

    const parsed = JSON.parse(savedUser);

    // Check credentials
    if (parsed.email !== form.email || parsed.password !== form.password) {
      setError("Incorrect email or password.");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      // Save logged in session
      const userData = { name: parsed.name, email: parsed.email };
      localStorage.setItem("loggedInUser", JSON.stringify(userData));

      onLogin(userData);
      setLoading(false);
      history.push("/");
    }, 1000);
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

        <p>
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
