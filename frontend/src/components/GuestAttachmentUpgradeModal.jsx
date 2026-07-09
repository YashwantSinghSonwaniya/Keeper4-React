import React from "react";
import ReactDOM from "react-dom";
import { useHistory } from "react-router-dom";

function GuestAttachmentUpgradeModal({ open, onClose }) {
  const history = useHistory();

  if (!open) return null;

  const portalTarget = typeof document !== "undefined" ? document.body : null;

  function handleSignIn() {
    history.push("/login");
    onClose();
  }

  function handleCreateAccount() {
    history.push("/register");
    onClose();
  }

  function handleLater() {
    onClose();
  }

  const modal = (
    <div className="guest-voice-backdrop" onClick={handleLater}>
      <div
        className="guest-voice-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-attachment-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="guest-voice-header">
          <span className="material-icons guest-voice-icon">attach_file</span>
          <div>
            <h3 id="guest-attachment-title">Attach files?</h3>
            <p className="guest-voice-subtitle">Premium feature for registered users</p>
          </div>
        </div>

        <div className="guest-voice-message">
          <p>
            Attachments let you keep images, documents, and other files right
            alongside your notes. Create a free account to start attaching
            files.
          </p>
        </div>

        <div className="guest-voice-actions">
          <button className="guest-voice-primary" onClick={handleCreateAccount}>
            Create Free Account
          </button>
          <button className="guest-voice-secondary" onClick={handleSignIn}>
            Sign In
          </button>
          <button className="guest-voice-later" onClick={handleLater}>
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );

  return portalTarget ? ReactDOM.createPortal(modal, portalTarget) : modal;
}

export default GuestAttachmentUpgradeModal;