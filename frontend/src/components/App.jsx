import React, { useState, useEffect } from "react";
import { Switch, Route, Redirect } from "react-router-dom";

import Home from "../pages/Home";
import Login from "../pages/Login";
import Register from "../pages/Register";
import ResetPassword from "../pages/ResetPassword";
import VerifyEmail from "../pages/VerifyEmail";

import toast from "react-hot-toast";
import Settings from "../pages/Settings";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("loggedInUser");

    if (token && savedUser) {
      setIsLoggedIn(true);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  function handleLogin(userData) {
    setIsLoggedIn(true);
    setUser(userData);
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("loggedInUser");
    setIsLoggedIn(false);
    setUser(null);
    toast.success("Logged out successfully!");
  }

  if (loading) return null;

  return (
    <Switch>
      <Route
        exact
        path="/"
        render={() => (
          <Home user={user} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
        )}
      />
      <Route
        path="/login"
        render={() =>
          isLoggedIn ? <Redirect to="/" /> : <Login onLogin={handleLogin} />
        }
      />
      <Route
        path="/register"
        render={() =>
          isLoggedIn ? (
            <Redirect to="/" />
          ) : (
            <Register onLogin={handleLogin} />
          )
        }
      />
      {/* ✅ Email verification — clicked from the verification email.
          Creates the account, logs in, redirects home. */}
      <Route
        path="/verify-email"
        render={() => <VerifyEmail onLogin={handleLogin} />}
      />
      {/* ✅ Password reset link target */}
      <Route path="/reset-password" render={() => <ResetPassword />} />
      <Route
        path="/settings"
        render={() => (
          <Settings
            user={user}
            isLoggedIn={isLoggedIn}
            onLogout={handleLogout}
          />
        )}
      />
    </Switch>
  );
}

export default App;