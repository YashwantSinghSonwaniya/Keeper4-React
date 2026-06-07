import React, { useState, useEffect, useRef } from "react";

const deleteSound = new Audio("/sounds/deleteButton.wav");

const NOTE_COLORS = [
  { name: "Default", hex: "#ffffff" },
  { name: "Red", hex: "#f28b82" },
  { name: "Coral", hex: "#ff8a65" },
  { name: "Yellow", hex: "#fff475" },
  { name: "Green", hex: "#ccff90" },
  { name: "Teal", hex: "#a7ffeb" },
  { name: "Blue", hex: "#cbf0f8" },
  { name: "Purple", hex: "#d7aefb" },
  { name: "Pink", hex: "#fdcfe8" },
  { name: "Dark", hex: "#232323" },
];

function Note(props) {
  const [showPalette, setShowPalette] = useState(false);
  const [palettePos, setPalettePos] = useState({ top: 0, left: 0 });
  const paletteRef = useRef(null);
  const paletteBtnRef = useRef(null);

  const isDark = props.color === "#232323";

  // ✅ Close palette when clicking outside
  useEffect(() => {
    if (!showPalette) return;

    function handleClickOutside(e) {
      if (
        paletteRef.current &&
        !paletteRef.current.contains(e.target) &&
        paletteBtnRef.current &&
        !paletteBtnRef.current.contains(e.target)
      ) {
        setShowPalette(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPalette]);

  // ✅ Calculate palette position from button location
  function handlePaletteToggle() {
    if (!showPalette && paletteBtnRef.current) {
      const rect = paletteBtnRef.current.getBoundingClientRect();
      const paletteWidth = 180;
      const paletteHeight = 115;
      const gap = 8;

      // Try to show above the button first
      let top = rect.top - paletteHeight - gap;
      let left = rect.left;

      // If not enough space above → show below the button
      if (top < 60) {
        top = rect.bottom + gap;
      }

      // Don't go off the right edge of screen
      if (left + paletteWidth > window.innerWidth - gap) {
        left = window.innerWidth - paletteWidth - gap;
      }

      // Don't go off the left edge
      if (left < gap) {
        left = gap;
      }

      // Don't go off the bottom of screen
      if (top + paletteHeight > window.innerHeight - gap) {
        top = rect.top - paletteHeight - gap;
      }

      setPalettePos({ top, left });
    }
    setShowPalette((prev) => !prev);
  }

  return (
    <div className="note" style={{ background: props.color || "#ffffff" }}>
      {/* ✅ Pin button — top right corner */}
      <button
        className={`pin-btn ${props.isPinned ? "pin-btn-active" : ""}`}
        onClick={() => props.onPin(props.id)}
        title={props.isPinned ? "Unpin note" : "Pin note"}
        style={{
          color: props.isPinned ? "#f5ba13" : isDark ? "#888" : "#ccc",
        }}
      >
        <span className="material-icons">push_pin</span>
      </button>

      {/* ✅ Color palette — rendered in portal style with fixed position */}
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

      <h1 style={{ color: isDark ? "#fff" : "#333" }}>{props.title}</h1>

      <p style={{ color: isDark ? "#ccc" : "#555" }}>{props.content}</p>

      {/* ✅ Note action buttons */}
      <div className="note-actions">
        {/* Palette button */}
        <button
          ref={paletteBtnRef}
          onClick={handlePaletteToggle}
          title="Change color"
          style={{ color: isDark ? "#ccc" : "#f5ba13" }}
        >
          <span className="material-icons">palette</span>
        </button>

        {/* Edit button */}
        <button
          onClick={() => props.onEdit(props.id)}
          title="Edit note"
          style={{ color: isDark ? "#82b4ff" : "#1976d2" }}
        >
          <span className="material-icons">edit</span>
        </button>

        {/* Delete button */}
        <button
          onClick={() => {
            deleteSound.currentTime = 0;
            deleteSound.play();
            props.onDelete(props.id);
          }}
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
