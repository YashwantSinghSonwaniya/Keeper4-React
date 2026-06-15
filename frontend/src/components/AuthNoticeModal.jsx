import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";

function AuthNoticeModal({
  open,
  title,
  message,
  primaryLabel = "Continue with Google",
  secondaryLabel = "Got it",
  onPrimary,
  onClose,
  primaryLoading = false,
}) {
  const primaryButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    if (primaryButtonRef.current) {
      primaryButtonRef.current.focus();
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const portalTarget = typeof document !== "undefined" ? document.body : null;

  const modal = (
    <div className="auth-notice-backdrop" onClick={onClose}>
      <div
        className="auth-notice-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-notice-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="auth-notice-header">
          <span className="material-icons auth-notice-icon">mark_email_unread</span>
          <div>
            <h3 id="auth-notice-title">{title}</h3>
            <p>{message}</p>
          </div>
        </div>

        <div className="auth-notice-actions">
          <button
            type="button"
            className="auth-notice-primary"
            onClick={onPrimary}
            disabled={primaryLoading}
            ref={primaryButtonRef}
          >
            {primaryLoading ? "Connecting..." : primaryLabel}
          </button>
          <button
            type="button"
            className="auth-notice-secondary"
            onClick={onClose}
            disabled={primaryLoading}
          >
            {secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return portalTarget ? ReactDOM.createPortal(modal, portalTarget) : modal;
}

export default AuthNoticeModal;
