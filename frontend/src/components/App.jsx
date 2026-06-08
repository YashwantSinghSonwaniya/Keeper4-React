import React, { useState, useEffect } from "react";
import { Switch, Route, Redirect } from "react-router-dom";

import Home from "../pages/Home";
import Login from "../pages/Login";
import Register from "../pages/Register";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ✅ Check token on app load
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
    // ✅ Clear everything
    localStorage.removeItem("token");
    localStorage.removeItem("loggedInUser");
    setIsLoggedIn(false);
    setUser(null);
  }

  // ✅ Don't render until we've checked auth
  if (loading) return null;

  return (
    <Switch>
      <Route
        exact
        path="/"
        render={() =>
          isLoggedIn ? (
            <Home user={user} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
          ) : (
            <Home user={null} isLoggedIn={false} onLogout={handleLogout} />
          )
        }
      />
      <Route
        path="/login"
        render={() =>
          isLoggedIn ? (
            <Redirect to="/" />
          ) : (
            <Login onLogin={handleLogin} />
          )
        }
      />
      <Route
        path="/register"
        render={() =>
          isLoggedIn ? <Redirect to="/" /> : <Register />
        }
      />
    </Switch>
  );
}

export default App;