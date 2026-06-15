import React from "react";
import { Link } from "react-router-dom";

function Header({ isLoggedIn, user, onLogout }) {
  const firstName = user?.name?.split(" ")[0] || "";

  return (
    <header>
      <h1>
        <img src="/favicon.png" alt="Keeper" className="header-logo" />
        Keeper
      </h1>

      <div className="header-right">
        {/* Settings icon — always visible */}
        <Link to="/settings" className="settings-icon-btn" title="Settings">
          <span className="material-icons">settings</span>
        </Link>

        {/* ✅ Only show when logged in */}
        {isLoggedIn && (
          <div className="auth-buttons">
            <span className="welcome-text">Hi, {firstName} 👋</span>
            <button className="logout-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        )}

        {/* ✅ NOT logged in — nothing here, banner handles Sign In */}
      </div>
    </header>
  );
}

export default Header;
