import React, { useEffect, useRef } from "react";

function GuestImportModal({
  open,
  count,
  deleteAfterImport,
  disablePrompt,
  onToggleDeleteAfterImport,
  onToggleDisablePrompt,
  onImport,
  onLater,
  loading,
}) {
  const importButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    if (importButtonRef.current) {
      importButtonRef.current.focus();
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onLater();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onLater]);

  if (!open) return null;

  return (
    <div className="guest-import-backdrop" onClick={onLater}>
      <div
        className="guest-import-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="guest-import-header">
          <span className="material-icons guest-import-icon">description</span>
          <div>
            <h3 id="guest-import-title">
              <span role="img" aria-label="document">
                📄
              </span>{" "}
              Import Guest Notes
            </h3>
            <p className="guest-import-subtitle">
              We found {count} note{count === 1 ? "" : "s"} stored on this
              device.
            </p>
          </div>
        </div>

        <div className="guest-import-message">
          <p>Would you like to import them into your account?</p>
        </div>

        <label className="guest-import-checkbox">
          <input
            type="checkbox"
            checked={deleteAfterImport}
            onChange={onToggleDeleteAfterImport}
          />
          Delete guest notes after successful import
        </label>

        <label className="guest-import-checkbox guest-import-remember">
          <input
            type="checkbox"
            checked={disablePrompt}
            onChange={onToggleDisablePrompt}
          />
          Don't remind me again
        </label>

        <div className="guest-import-actions">
          <button
            type="button"
            className="auth-btn guest-import-primary"
            onClick={onImport}
            disabled={loading}
            ref={importButtonRef}
          >
            {loading ? "Importing..." : "Import Notes"}
          </button>
          <button
            type="button"
            className="auth-btn auth-btn-secondary guest-import-secondary"
            onClick={onLater}
            disabled={loading}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

export default GuestImportModal;
