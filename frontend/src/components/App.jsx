// 2nd
import React, { useState, useEffect } from "react";
import { Switch, Route, Redirect } from "react-router-dom";

import Home from "../pages/Home";
import Login from "../pages/Login";
import Register from "../pages/Register";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("loggedInUser");
    if (savedUser) {
      setIsLoggedIn(true);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  function handleLogin(userData) {
    setIsLoggedIn(true);
    setUser(userData);
  }

  function handleLogout() {
    localStorage.removeItem("loggedInUser");
    setIsLoggedIn(false);
    setUser(null);
  }

  return (
    <Switch>
      {/* Home is open to everyone */}
      <Route
        exact
        path="/"
        render={() => (
          <Home user={user} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
        )}
      />

      {/* Already logged in? Skip login page */}
      <Route
        path="/login"
        render={() =>
          isLoggedIn ? <Redirect to="/" /> : <Login onLogin={handleLogin} />
        }
      />

      {/* Already logged in? Skip register page */}
      <Route
        path="/register"
        render={() => (isLoggedIn ? <Redirect to="/" /> : <Register />)}
      />
    </Switch>
  );
}

export default App;
