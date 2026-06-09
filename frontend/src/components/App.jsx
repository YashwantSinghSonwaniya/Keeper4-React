import React, { useState, useEffect } from "react";
import { Switch, Route, Redirect } from "react-router-dom";

import Home from "../pages/Home";
import Login from "../pages/Login";
import Register from "../pages/Register";

import toast from "react-hot-toast";
import Settings from "../pages/Settings";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ✅ Only token + user info needed — no notes in localStorage
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
        render={() => (isLoggedIn ? <Redirect to="/" /> : <Register />)}
      />
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
