import React from "react";
import { Link } from "react-router-dom";

function Header({ isLoggedIn, user, onLogout }) {
  const firstName = user?.name?.split(" ")[0] || "";

  return (
    <header>
      <h1>
        <span className="material-icons">note</span>
        Keeper
      </h1>

      <div className="header-right">
        {/* ✅ Settings icon — always visible */}
        <Link to="/settings" className="settings-icon-btn" title="Settings">
          <span className="material-icons">settings</span>
        </Link>

        {isLoggedIn ? (
          <div className="auth-buttons">
            <span className="welcome-text">Hi, {firstName} 👋</span>
            <button className="logout-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        ) : (
          <div className="auth-buttons">
            <Link to="/login" className="signin-btn">Sign In</Link>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;