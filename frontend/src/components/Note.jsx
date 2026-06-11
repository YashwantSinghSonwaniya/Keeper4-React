import React, { useState, useEffect, useRef, useCallback } from "react";
import CATEGORIES from "../categories";
import VoiceNotePlayer from "./VoiceNotePlayer";

const NOTE_COLORS = [
  { name: "Default", hex: "#ffffff" },
  { name: "Red",     hex: "#f28b82" },
  { name: "Coral",   hex: "#ff8a65" },
  { name: "Yellow",  hex: "#fff475" },
  { name: "Green",   hex: "#ccff90" },
  { name: "Teal",    hex: "#a7ffeb" },
  { name: "Blue",    hex: "#cbf0f8" },
  { name: "Purple",  hex: "#d7aefb" },
  { name: "Pink",    hex: "#fdcfe8" },
  { name: "Dark",    hex: "#232323" },
];

function Note(props) {
  const [showPalette, setShowPalette] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [localOverflowOpen, setLocalOverflowOpen] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [palettePos, setPalettePos] = useState({ top: 0, left: 0 });
  const [categoryPos, setCategoryPos] = useState({ top: 0, left: 0 });

  const paletteRef = useRef(null);
  const paletteBtnRef = useRef(null);
  const categoryRef = useRef(null);
  const categoryBtnRef = useRef(null);
  const exportRef = useRef(null);
  const exportBtnRef = useRef(null);

  const { id, onCloseExportDropdown } = props;
  const isDark = props.color === "#232323";
  const isOverflowControlled = props.exportDropdownOpen !== undefined;
  const overflowMenuOpen = isOverflowControlled
    ? props.exportDropdownOpen
    : localOverflowOpen;
  const speechState = props.speechState || {};
  const isSpeechActive = Boolean(speechState.isActive);
  const isSpeechReading = Boolean(speechState.isReading);

  function handleReadClick(e) {
    e.stopPropagation();
    closeOverflowMenu();
    if (props.onReadAloud) {
      props.onReadAloud(props.id, {
        title: props.title,
        content: props.content,
      });
    }
  }

  const currentCategory = CATEGORIES.find(
    (c) => c.id === (props.category || "none")
  );

  const closeOverflowMenu = useCallback(() => {
    setShowExportOptions(false);

    if (isOverflowControlled) {
      if (onCloseExportDropdown) onCloseExportDropdown(id);
      return;
    }

    setLocalOverflowOpen(false);
  }, [id, isOverflowControlled, onCloseExportDropdown]);

  function handleOverflowToggle(e) {
    e.stopPropagation();
    setShowPalette(false);
    setShowCategoryPicker(false);

    if (props.onToggleExportDropdown) {
      if (overflowMenuOpen) setShowExportOptions(false);
      props.onToggleExportDropdown(props.id);
    } else {
      setLocalOverflowOpen((prev) => {
        if (prev) setShowExportOptions(false);
        return !prev;
      });
    }
  }

  function handleExportOptionsToggle(e) {
    e.stopPropagation();
    setShowExportOptions((prev) => !prev);
  }

  function handleExport(format) {
    if (props.onExport) {
      props.onExport(props.id, format);
    }
    closeOverflowMenu();
  }

  function handleEditClick(e) {
    e.stopPropagation();
    closeOverflowMenu();
    props.onEdit(props.id);
  }

  function handleDeleteClick(e) {
    e.stopPropagation();
    closeOverflowMenu();
    props.onDelete(props.id);
  }

  useEffect(() => {
    if (!overflowMenuOpen) setShowExportOptions(false);
  }, [overflowMenuOpen]);

  // Close palettes on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        paletteRef.current &&
        !paletteRef.current.contains(e.target) &&
        (!paletteBtnRef.current ||
          !paletteBtnRef.current.contains(e.target))
      ) {
        setShowPalette(false);
      }
      if (
        categoryRef.current &&
        !categoryRef.current.contains(e.target) &&
        (!categoryBtnRef.current ||
          !categoryBtnRef.current.contains(e.target))
      ) {
        setShowCategoryPicker(false);
      }
      if (
        exportRef.current &&
        !exportRef.current.contains(e.target) &&
        exportBtnRef.current &&
        !exportBtnRef.current.contains(e.target)
      ) {
        closeOverflowMenu();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [closeOverflowMenu]);

  function handlePaletteToggle() {
    if (!showPalette && paletteBtnRef.current) {
      const rect = paletteBtnRef.current.getBoundingClientRect();
      const paletteWidth = 180;
      const paletteHeight = 115;
      const gap = 8;

      let top = rect.top - paletteHeight - gap;
      let left = rect.left - paletteWidth / 2;

      if (top < 60) top = rect.bottom + gap;
      if (left + paletteWidth > window.innerWidth - gap)
        left = window.innerWidth - paletteWidth - gap;
      if (left < gap) left = gap;
      if (top + paletteHeight > window.innerHeight - gap)
        top = rect.top - paletteHeight - gap;

      setPalettePos({ top, left });
    }
    setShowPalette((prev) => !prev);
    setShowCategoryPicker(false);
    closeOverflowMenu();
  }

  function handleCategoryToggle() {
    if (!showCategoryPicker && categoryBtnRef.current) {
      const rect = categoryBtnRef.current.getBoundingClientRect();
      const pickerWidth = 160;
      const pickerHeight = 220;
      const gap = 8;

      let top = rect.top - pickerHeight - gap;
      let left = rect.left - pickerWidth / 2;

      if (top < 60) top = rect.bottom + gap;
      if (left + pickerWidth > window.innerWidth - gap)
        left = window.innerWidth - pickerWidth - gap;
      if (left < gap) left = gap;

      setCategoryPos({ top, left });
    }
    setShowCategoryPicker((prev) => !prev);
    setShowPalette(false);
    closeOverflowMenu();
  }

  return (
    <div
      className={`note ${isSpeechReading ? "note-reading" : ""}`}
      style={{ background: props.color || "#ffffff" }}
    >
      {/* Pin button */}
      <button
        className={`pin-btn ${props.isPinned ? "pin-btn-active" : ""}`}
        onClick={() => props.onPin(props.id)}
        title={props.isPinned ? "Unpin note" : "Pin note"}
        style={{
          color: props.isPinned
            ? "#f5ba13"
            : isDark ? "#888" : "#ccc",
        }}
      >
        <span className="material-icons">push_pin</span>
      </button>

      {/* Color palette */}
      {showPalette && (
        <div
          className="color-palette"
          ref={paletteRef}
          style={{ top: palettePos.top, left: palettePos.left }}
        >
          {NOTE_COLORS.map((c) => (
            <button
              key={c.hex}
              className="color-dot"
              title={c.name}
              style={{
                background: c.hex,
                border:
                  props.color === c.hex
                    ? "2px solid #333"
                    : "2px solid transparent",
              }}
              onClick={() => {
                props.onColorChange(props.id, c.hex);
                setShowPalette(false);
              }}
            />
          ))}
        </div>
      )}

      {/* Category picker */}
      {showCategoryPicker && (
        <div
          className="category-picker"
          ref={categoryRef}
          style={{ top: categoryPos.top, left: categoryPos.left }}
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`category-option ${
                (props.category || "none") === cat.id
                  ? "category-option-active"
                  : ""
              }`}
              onClick={() => {
                props.onCategoryChange(props.id, cat.id);
                setShowCategoryPicker(false);
              }}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Category badge — shows current category */}
      {props.category && props.category !== "none" && (
        <div
          className={`note-category-badge ${
            isDark ? "note-category-badge-dark" : ""
          }`}
        >
          {currentCategory?.emoji} {currentCategory?.label}
        </div>
      )}

      <h1 style={{ color: isDark ? "#fff" : "#333" }}>
        {props.title}
      </h1>

      <p style={{ color: isDark ? "#ccc" : "#555" }}>
        {props.content}
      </p>

      <VoiceNotePlayer
        voiceNote={props.voiceNote}
        isDark={isDark}
      />

      {isSpeechActive && (
        <div className={`reading-indicator ${isDark ? "reading-indicator-dark" : ""}`}>
          <span className="speaker-pulse" aria-hidden="true">
            🔊
          </span>
          <span>{isSpeechReading ? "Reading..." : "Paused"}</span>
        </div>
      )}

      {/* Note actions */}
      <div className="note-actions">
        {/* Read aloud */}
        <button
          className={`read-aloud-btn ${isSpeechActive ? "read-aloud-active" : ""}`}
          onClick={handleReadClick}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          title="Read aloud"
          aria-label={`${speechState.label || "Read"} note aloud`}
          style={{ color: isSpeechActive ? "#f5ba13" : isDark ? "#ccc" : "#5f6368" }}
        >
          <span className="read-aloud-icon" aria-hidden="true">
            {speechState.icon || "🔊"}
          </span>
          <span className="read-aloud-label">{speechState.label || "Read"}</span>
        </button>

        {/* More actions */}
        <div className="note-overflow-wrapper">
          <button
            ref={exportBtnRef}
            className="note-overflow-btn"
            onClick={handleOverflowToggle}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            title="More actions"
            aria-label="More note actions"
            aria-expanded={overflowMenuOpen}
            aria-haspopup="menu"
            style={{ color: isDark ? "#ccc" : "#5f6368" }}
          >
            <span className="material-icons">more_vert</span>
          </button>

          {overflowMenuOpen && (
            <div
              className={`note-overflow-menu ${isDark ? "note-overflow-menu-dark" : ""}`}
              ref={exportRef}
              role="menu"
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="note-overflow-item"
                role="menuitem"
                onClick={handleEditClick}
              >
                <span className="material-icons">edit</span>
                <span>Edit</span>
              </button>

              <button
                ref={paletteBtnRef}
                type="button"
                className="note-overflow-item"
                role="menuitem"
                onClick={handlePaletteToggle}
              >
                <span className="material-icons">palette</span>
                <span>Color</span>
              </button>

              <button
                ref={categoryBtnRef}
                type="button"
                className="note-overflow-item"
                role="menuitem"
                onClick={handleCategoryToggle}
              >
                <span className="material-icons">label</span>
                <span>Category</span>
              </button>

              <div className="note-overflow-export-group">
                <button
                  type="button"
                  className="note-overflow-item note-overflow-item-with-caret"
                  role="menuitem"
                  onClick={handleExportOptionsToggle}
                  aria-haspopup="menu"
                >
                  <span className="material-icons">file_download</span>
                  <span>Export</span>
                  <span className="note-overflow-caret" aria-hidden="true">
                    {showExportOptions ? "▾" : "▸"}
                  </span>
                </button>

                {showExportOptions && (
                  <div className="note-export-options" role="menu">
                    {["pdf", "txt", "json"].map((format) => (
                      <button
                        key={format}
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExport(format);
                        }}
                      >
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={handleDeleteClick}
          title="Delete note"
          style={{ color: isDark ? "#ff8a80" : "#d32f2f" }}
        >
          <span className="material-icons">delete</span>
        </button>
      </div>
    </div>
  );
}

export default Note;
