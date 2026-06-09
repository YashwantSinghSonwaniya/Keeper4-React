import React, { useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";

function Settings({ user, isLoggedIn, onLogout }) {
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState(
    localStorage.getItem("skipDeleteConfirm") === "true"
  );

  function handleSkipDeleteConfirm(e) {
    const value = e.target.checked;
    setSkipDeleteConfirm(value);
    localStorage.setItem("skipDeleteConfirm", value);
  }

  return (
    <div className="page-content">
      <Header isLoggedIn={isLoggedIn} user={user} onLogout={onLogout} />

      <div className="settings-page">
        <div className="settings-container">

          {/* Back button */}
          <Link to="/" className="settings-back-btn">
            <span className="material-icons">arrow_back</span>
            Back to notes
          </Link>

          <h2 className="settings-title">Settings</h2>

          {/* Preferences Section */}
          <div className="settings-section">
            <h3 className="settings-section-title">
              <span className="material-icons">tune</span>
              Preferences
            </h3>

            <div className="settings-item">
              <div className="settings-item-info">
                <p className="settings-item-label">
                  Skip delete confirmation
                </p>
                <p className="settings-item-desc">
                  When enabled, notes are deleted immediately
                  without asking for confirmation.
                </p>
              </div>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={skipDeleteConfirm}
                  onChange={handleSkipDeleteConfirm}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Account Section — only for logged in users */}
          {isLoggedIn && (
            <div className="settings-section">
              <h3 className="settings-section-title">
                <span className="material-icons">person</span>
                Account
              </h3>

              <div className="settings-item">
                <div className="settings-item-info">
                  <p className="settings-item-label">Name</p>
                  <p className="settings-item-desc">{user?.name}</p>
                </div>
              </div>

              <div className="settings-item">
                <div className="settings-item-info">
                  <p className="settings-item-label">Email</p>
                  <p className="settings-item-desc">{user?.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Coming soon section */}
          <div className="settings-section settings-section-muted">
            <h3 className="settings-section-title">
              <span className="material-icons">download</span>
              Data
            </h3>
            <div className="settings-item">
              <div className="settings-item-info">
                <p className="settings-item-label">Export notes</p>
                <p className="settings-item-desc">
                  Download your notes as PDF, TXT or JSON.
                </p>
              </div>
              <span className="settings-coming-soon">Coming soon</span>
            </div>
          </div>

        </div>
      </div>

      <Footer />
    </div>
  );
}

export default Settings;