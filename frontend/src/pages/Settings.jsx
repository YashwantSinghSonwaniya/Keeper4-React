import React, { useState } from "react";
import { Link, useHistory } from "react-router-dom";
import toast from "react-hot-toast";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { changePassword, deleteAccount, updateProfile } from "../api";

function Settings({ user, isLoggedIn, onLogout }) {
  const history = useHistory();

  // Preferences
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState(
    localStorage.getItem("skipDeleteConfirm") === "true",
  );

  const [showEditName, setShowEditName] = useState(false);
  const [newName, setNewName] = useState(user?.name || "");
  const [nameLoading, setNameLoading] = useState(false);

  // Change password
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Delete account
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  function handleSkipDeleteConfirm(e) {
    const value = e.target.checked;
    setSkipDeleteConfirm(value);
    localStorage.setItem("skipDeleteConfirm", value);
    toast.success(value ? "Confirmations disabled" : "Confirmations enabled");
  }

  async function handleChangePassword(e) {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords don't match.");
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success("Password changed successfully!");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowChangePassword(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to change password.");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleDeleteAccount(e) {
    e.preventDefault();
    setDeleteLoading(true);

    try {
      await deleteAccount({ password: deletePassword });
      toast.success("Account deleted.");
      onLogout();
      history.push("/register");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete account.");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleUpdateName(e) {
    e.preventDefault();

    if (newName.trim() === user?.name) {
      toast.error("Name is the same as current name.");
      return;
    }

    setNameLoading(true);
    try {
      const res = await updateProfile({ name: newName.trim() });

      const updatedUser = res.data.user;
      localStorage.setItem("loggedInUser", JSON.stringify(updatedUser));

      toast.success("Name updated successfully! 🎉");
      setShowEditName(false);

      // ✅ Wait 1.5 seconds so toast is visible before reload
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update name.");
    } finally {
      setNameLoading(false);
    }
  }

  return (
    <div className="page-content">
      <Header isLoggedIn={isLoggedIn} user={user} onLogout={onLogout} />

      <div className="settings-page">
        <div className="settings-container">
          <Link to="/" className="settings-back-btn">
            <span className="material-icons">arrow_back</span>
            Back to notes
          </Link>

          <h2 className="settings-title">Settings</h2>

          {/* ======= PREFERENCES ======= */}
          <div className="settings-section">
            <h3 className="settings-section-title">
              <span className="material-icons">tune</span>
              Preferences
            </h3>

            <div className="settings-item">
              <div className="settings-item-info">
                <p className="settings-item-label">Skip delete confirmation</p>
                <p className="settings-item-desc">
                  When enabled, notes are deleted immediately without asking for
                  confirmation.
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

          {/* ======= ACCOUNT ======= */}
          {isLoggedIn && (
            <div className="settings-section">
              <h3 className="settings-section-title">
                <span className="material-icons">person</span>
                Account
              </h3>

              {/* Name */}
              <div className="settings-item settings-item-col">
                <div
                  className="settings-item-row"
                  onClick={() => setShowEditName(!showEditName)}
                >
                  <div className="settings-item-info">
                    <p className="settings-item-label">Name</p>
                    <p className="settings-item-desc">{user?.name}</p>
                  </div>
                  <span className="material-icons settings-chevron">
                    {showEditName ? "expand_less" : "expand_more"}
                  </span>
                </div>

                {showEditName && (
                  <form onSubmit={handleUpdateName} className="settings-form">
                    <input
                      type="text"
                      placeholder="Enter new name"
                      value={newName}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewName(value);
                      }}
                      required
                      className="settings-input"
                    />
                    <button
                      type="submit"
                      className="settings-save-btn"
                      disabled={nameLoading}
                    >
                      {nameLoading ? "Updating..." : "Update Name"}
                    </button>
                  </form>
                )}
              </div>

              <div className="settings-item">
                <div className="settings-item-info">
                  <p className="settings-item-label">Email</p>
                  <p className="settings-item-desc">{user?.email}</p>
                </div>
              </div>

              {/* Change Password */}
              <div className="settings-item settings-item-col">
                <div
                  className="settings-item-row"
                  onClick={() => setShowChangePassword(!showChangePassword)}
                >
                  <div className="settings-item-info">
                    <p className="settings-item-label">Change password</p>
                    <p className="settings-item-desc">
                      Update your account password.
                    </p>
                  </div>
                  <span className="material-icons settings-chevron">
                    {showChangePassword ? "expand_less" : "expand_more"}
                  </span>
                </div>

                {showChangePassword && (
                  <form
                    onSubmit={handleChangePassword}
                    className="settings-form"
                  >
                    <input
                      type="password"
                      placeholder="Current password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPasswordForm((prev) => ({
                          ...prev,
                          currentPassword: value,
                        }));
                      }}
                      required
                      className="settings-input"
                    />
                    <input
                      type="password"
                      placeholder="New password"
                      value={passwordForm.newPassword}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPasswordForm((prev) => ({
                          ...prev,
                          newPassword: value,
                        }));
                      }}
                      required
                      className="settings-input"
                    />
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPasswordForm((prev) => ({
                          ...prev,
                          confirmPassword: value,
                        }));
                      }}
                      required
                      className="settings-input"
                    />
                    <button
                      type="submit"
                      className="settings-save-btn"
                      disabled={passwordLoading}
                    >
                      {passwordLoading ? "Updating..." : "Update Password"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* ======= DATA ======= */}
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

          {/* ======= DANGER ZONE ======= */}
          {isLoggedIn && (
            <div className="settings-section settings-danger-zone">
              <h3 className="settings-section-title danger">
                <span className="material-icons">warning</span>
                Danger Zone
              </h3>

              <div className="settings-item settings-item-col">
                <div
                  className="settings-item-row"
                  onClick={() => setShowDeleteAccount(!showDeleteAccount)}
                >
                  <div className="settings-item-info">
                    <p className="settings-item-label danger-label">
                      Delete account
                    </p>
                    <p className="settings-item-desc">
                      Permanently delete your account and all notes. This cannot
                      be undone.
                    </p>
                  </div>
                  <span className="material-icons settings-chevron danger-chevron">
                    {showDeleteAccount ? "expand_less" : "expand_more"}
                  </span>
                </div>

                {showDeleteAccount && (
                  <form
                    onSubmit={handleDeleteAccount}
                    className="settings-form"
                  >
                    <p className="danger-warning">
                      ⚠️ This will permanently delete your account and all your
                      notes. Enter your password to confirm.
                    </p>
                    <input
                      type="password"
                      placeholder="Enter your password to confirm"
                      value={deletePassword}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDeletePassword(value);
                      }}
                      required
                      className="settings-input danger-input"
                    />
                    <button
                      type="submit"
                      className="settings-delete-btn"
                      disabled={deleteLoading}
                    >
                      {deleteLoading ? "Deleting..." : "Yes, delete my account"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default Settings;
