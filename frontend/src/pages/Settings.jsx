import React, { useState, useEffect } from "react";
import { Link, useHistory } from "react-router-dom";
import toast from "react-hot-toast";
import Header from "../components/Header";
import Footer from "../components/Footer";
import {
  changePassword,
  deleteAccount,
  updateProfile,
  importNotes,
} from "../api";
import {
  loadSpeechSettings,
  saveSpeechSettings,
} from "../speechSettings";

function Settings({ user, isLoggedIn, onLogout }) {
  const history = useHistory();

  // Preferences
  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState(
    localStorage.getItem("skipDeleteConfirm") === "true",
  );
  const speechSupported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window;
  const [speechSettings, setSpeechSettings] = useState(() =>
    loadSpeechSettings(),
  );
  const [speechVoices, setSpeechVoices] = useState([]);

  const [showEditName, setShowEditName] = useState(false);
  const [newName, setNewName] = useState(user?.name || "");
  const [nameLoading, setNameLoading] = useState(false);

  const [guestNotesCount, setGuestNotesCount] = useState(0);
  const [guestImportLoading, setGuestImportLoading] = useState(false);
  const [disableGuestImportPrompt, setDisableGuestImportPrompt] = useState(false);

  function getGuestPromptUserKey() {
    if (!user) return null;
    if (user.id) return `user_${user.id}`;
    return `user_${encodeURIComponent(user.email || "unknown")}`;
  }

  function getGuestPromptDisabledKey(userKey) {
    return `disableGuestImportPrompt_${userKey}`;
  }

  function getGuestImportPromptPendingKey(userKey) {
    return `guestImportPromptPending_${userKey}`;
  }

  function getGuestImportPromptHandledKey(userKey) {
    return `guestImportPromptHandled_${userKey}`;
  }

  function getGuestPromptLastTimestampKey(userKey) {
    return `lastGuestImportPrompt_${userKey}`;
  }

  function getGuestNotesCount() {
    const saved = localStorage.getItem("notes_guest");
    if (!saved) return 0;
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch (err) {
      console.error("Could not parse guest notes:", err);
      return 0;
    }
  }

  function refreshGuestNotesCount() {
    setGuestNotesCount(getGuestNotesCount());
    const userKey = getGuestPromptUserKey();
    setDisableGuestImportPrompt(
      userKey
        ? localStorage.getItem(getGuestPromptDisabledKey(userKey)) === "true"
        : false,
    );
  }

  useEffect(() => {
    refreshGuestNotesCount();
  }, [user]);

  useEffect(() => {
    if (!speechSupported) return undefined;

    function loadVoices() {
      setSpeechVoices(window.speechSynthesis.getVoices() || []);
    }

    loadVoices();
    if (typeof window.speechSynthesis.addEventListener === "function") {
      window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    } else {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (typeof window.speechSynthesis.removeEventListener === "function") {
        window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      } else if (window.speechSynthesis.onvoiceschanged === loadVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [speechSupported]);

  function updateSpeechSetting(name, value) {
    if (!speechSupported) {
      toast.error("Speech reading is not supported in this browser.");
      return;
    }

    const nextSettings = saveSpeechSettings({
      ...speechSettings,
      [name]: name === "voiceURI" ? value : Number(value),
    });
    setSpeechSettings(nextSettings);
  }

  async function handleManualImportGuestNotes() {
    if (!isLoggedIn) {
      toast.error("Please sign in to import guest notes.");
      return;
    }

    const saved = localStorage.getItem("notes_guest");
    if (!saved) {
      toast.error("No guest notes available.");
      return;
    }

    let guestNotes = [];
    try {
      const parsed = JSON.parse(saved);
      guestNotes = Array.isArray(parsed)
        ? parsed.filter((item) => item && typeof item === "object")
        : [];
    } catch (err) {
      console.error("Could not parse guest notes:", err);
      toast.error("Unable to read guest notes.");
      return;
    }

    if (guestNotes.length === 0) {
      toast.error("No guest notes found to import.");
      return;
    }

    const userKey = getGuestPromptUserKey();
    if (!userKey) {
      toast.error("Unable to determine current user.");
      return;
    }

    setGuestImportLoading(true);
    try {
      const notesToImport = guestNotes.map((note, index) => ({
        title: note.title || "",
        content: note.content || "",
        color: note.color || "#ffffff",
        is_pinned: note.isPinned || note.is_pinned || false,
        category: note.category || "none",
        position: index,
      }));

      await importNotes(notesToImport);
      localStorage.removeItem("notes_guest");
      localStorage.setItem(`guestNotesImported_${userKey}`, "true");
      localStorage.setItem(
        getGuestPromptLastTimestampKey(userKey),
        Date.now().toString(),
      );
      sessionStorage.setItem(getGuestImportPromptHandledKey(userKey), "true");
      sessionStorage.setItem(getGuestImportPromptPendingKey(userKey), "false");

      toast.success(
        `Imported ${guestNotes.length} guest note${
          guestNotes.length === 1 ? "" : "s"
        }`,
      );
      refreshGuestNotesCount();
    } catch (err) {
      console.error("Failed to import guest notes:", err);
      toast.error("Failed to import guest notes.");
    } finally {
      setGuestImportLoading(false);
    }
  }

  function handleDisableGuestPromptToggle(e) {
    const value = e.target.checked;
    const userKey = getGuestPromptUserKey();
    if (!userKey) {
      toast.error("Unable to determine current user.");
      return;
    }

    setDisableGuestImportPrompt(value);
    localStorage.setItem(getGuestPromptDisabledKey(userKey), value ? "true" : "false");
    toast.success(
      value ? "Guest import reminders disabled." : "Guest import reminders enabled.",
    );
  }

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

          <div className="settings-section">
            <h3 className="settings-section-title">
              <span aria-hidden="true">🔊</span>
              Speech Settings
            </h3>

            {!speechSupported && (
              <div className="settings-alert">
                Speech reading is not supported in this browser.
              </div>
            )}

            <div className="settings-item settings-item-col speech-setting-item">
              <div className="settings-item-info">
                <p className="settings-item-label">Speech Rate</p>
                <p className="settings-item-desc">
                  Choose how quickly notes are read aloud. Current: {speechSettings.rate.toFixed(1)}x
                </p>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={speechSettings.rate}
                onChange={(e) => updateSpeechSetting("rate", e.target.value)}
                disabled={!speechSupported}
                className="settings-range"
              />
            </div>

            <div className="settings-item settings-item-col speech-setting-item">
              <div className="settings-item-info">
                <p className="settings-item-label">Pitch</p>
                <p className="settings-item-desc">
                  Adjust the voice pitch. Current: {speechSettings.pitch.toFixed(1)}
                </p>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={speechSettings.pitch}
                onChange={(e) => updateSpeechSetting("pitch", e.target.value)}
                disabled={!speechSupported}
                className="settings-range"
              />
            </div>

            <div className="settings-item settings-item-col speech-setting-item">
              <div className="settings-item-info">
                <p className="settings-item-label">Voice Selection</p>
                <p className="settings-item-desc">
                  {speechVoices.length > 0
                    ? "Pick one of the voices available in this browser."
                    : "No browser voices are listed yet. The default browser voice will be used."}
                </p>
              </div>
              <select
                value={speechSettings.voiceURI}
                onChange={(e) => updateSpeechSetting("voiceURI", e.target.value)}
                disabled={!speechSupported || speechVoices.length === 0}
                className="settings-select"
              >
                <option value="">Browser default voice</option>
                {speechVoices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} {voice.lang ? `(${voice.lang})` : ""}
                  </option>
                ))}
              </select>
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
              Data & Storage
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

          <div className="settings-section">
            <h3 className="settings-section-title">
              <span className="material-icons">folder_shared</span>
              Guest notes
            </h3>
            <div className="settings-item settings-item-col">
              <div className="settings-item-info">
                <p className="settings-item-label">Guest notes stored locally</p>
                <p className="settings-item-desc">
                  {guestNotesCount > 0
                    ? `You have ${guestNotesCount} guest note${guestNotesCount === 1 ? "" : "s"} stored in this browser.`
                    : "No guest notes are currently saved on this device."}
                </p>
              </div>
              {guestNotesCount > 0 && isLoggedIn ? (
                <button
                  type="button"
                  className="settings-save-btn"
                  disabled={guestImportLoading}
                  onClick={handleManualImportGuestNotes}
                >
                  {guestImportLoading ? "Importing..." : "Import guest notes"}
                </button>
              ) : (
                <p className="settings-item-desc">
                  {isLoggedIn
                    ? "Sign in and return here after using guest mode to import notes into your account."
                    : "Sign in or register to enable guest note import."}
                </p>
              )}
            </div>

            <div className="settings-item">
              <div className="settings-item-info">
                <p className="settings-item-label">Disable automatic guest import prompts</p>
                <p className="settings-item-desc">
                  Turn this on to stop automatic reminders when guest notes exist.
                </p>
              </div>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={disableGuestImportPrompt}
                  onChange={handleDisableGuestPromptToggle}
                />
                <span className="toggle-slider"></span>
              </label>
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
