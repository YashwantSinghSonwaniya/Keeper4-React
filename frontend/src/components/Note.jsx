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
  const [localExportOpen, setLocalExportOpen] = useState(false);
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
  const isExportControlled = props.exportDropdownOpen !== undefined;
  const exportDropdownOpen = isExportControlled
    ? props.exportDropdownOpen
    : localExportOpen;
  const speechState = props.speechState || {};
  const isSpeechActive = Boolean(speechState.isActive);
  const isSpeechReading = Boolean(speechState.isReading);

  function handleReadClick(e) {
    e.stopPropagation();
    closeExportDropdown();
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

  const closeExportDropdown = useCallback(() => {
    if (isExportControlled) {
      if (onCloseExportDropdown) onCloseExportDropdown(id);
      return;
    }

    setLocalExportOpen(false);
  }, [id, isExportControlled, onCloseExportDropdown]);

  function handleExportToggle(e) {
    e.stopPropagation();
    if (props.onToggleExportDropdown) {
      props.onToggleExportDropdown(props.id);
    } else {
      setLocalExportOpen((prev) => !prev);
    }

    setShowPalette(false);
    setShowCategoryPicker(false);
  }

  function handleExport(format) {
    if (props.onExport) {
      props.onExport(props.id, format);
    }
    closeExportDropdown();
  }

  // Close palettes on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        paletteRef.current &&
        !paletteRef.current.contains(e.target) &&
        paletteBtnRef.current &&
        !paletteBtnRef.current.contains(e.target)
      ) {
        setShowPalette(false);
      }
      if (
        categoryRef.current &&
        !categoryRef.current.contains(e.target) &&
        categoryBtnRef.current &&
        !categoryBtnRef.current.contains(e.target)
      ) {
        setShowCategoryPicker(false);
      }
      if (
        exportRef.current &&
        !exportRef.current.contains(e.target) &&
        exportBtnRef.current &&
        !exportBtnRef.current.contains(e.target)
      ) {
        closeExportDropdown();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [closeExportDropdown]);

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
    closeExportDropdown();
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
    closeExportDropdown();
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

        {/* Export */}
        <div className="note-export-wrapper">
          <button
            ref={exportBtnRef}
            className="note-export-btn"
            onClick={handleExportToggle}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            title="Export note"
            aria-expanded={exportDropdownOpen}
            aria-haspopup="menu"
            style={{ color: isDark ? "#ccc" : "#5f6368" }}
          >
            <span>Export ▼</span>
          </button>

          {exportDropdownOpen && (
            <div
              className={`note-export-menu ${isDark ? "note-export-menu-dark" : ""}`}
              ref={exportRef}
              role="menu"
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
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

        {/* Color */}
        <button
          ref={paletteBtnRef}
          onClick={handlePaletteToggle}
          title="Change color"
          style={{ color: isDark ? "#ccc" : "#f5ba13" }}
        >
          <span className="material-icons">palette</span>
        </button>

        {/* Category */}
        <button
          ref={categoryBtnRef}
          onClick={handleCategoryToggle}
          title="Set category"
          style={{ color: isDark ? "#ccc" : "#9c27b0" }}
        >
          <span className="material-icons">label</span>
        </button>

        {/* Edit */}
        <button
          onClick={() => props.onEdit(props.id)}
          title="Edit note"
          style={{ color: isDark ? "#82b4ff" : "#1976d2" }}
        >
          <span className="material-icons">edit</span>
        </button>

        {/* Delete */}
        <button
          onClick={() => props.onDelete(props.id)}
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
