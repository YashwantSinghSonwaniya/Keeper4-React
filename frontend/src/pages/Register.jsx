import React, { useState } from "react";
import { Link, useHistory } from "react-router-dom";

function Register() {
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

  function handleRegister(e) {
    e.preventDefault();
    setError("");

    // Basic validation
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    // Check if email already registered
    const existingUser = localStorage.getItem("registeredUser");
    if (existingUser) {
      const parsed = JSON.parse(existingUser);
      if (parsed.email === form.email) {
        setError("This email is already registered.");
        return;
      }
    }

    setLoading(true);

    setTimeout(() => {
      // Save user credentials to localStorage
      localStorage.setItem(
        "registeredUser",
        JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
        })
      );

      setLoading(false);
      // Redirect to login after successful registration
      history.push("/login");
    }, 1000);
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
