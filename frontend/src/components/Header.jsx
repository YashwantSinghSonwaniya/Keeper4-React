import React from "react";

function Header({ isLoggedIn, user, onLogout }) {
  // ✅ Extract first name only
  const firstName = user?.name?.split(" ")[0] || "";

  return (
    <header>
      <h1>
        <span className="material-icons">note</span>
        Keeper
      </h1>

      {isLoggedIn && (
        <div className="auth-buttons">
          <span className="welcome-text">Hi, {firstName} 👋</span>
          <button className="logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      )}
    </header>
  );
}

export default Header;
