import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
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

/**
 * The note action system is now driven by a SINGLE global "open menu" id
 * (props.openMenuId / props.onOpenMenu / props.onCloseMenu) that lives in
 * Home.jsx. This guarantees only ONE note menu can ever be open at a time.
 *
 * The dropdown itself is rendered through a React PORTAL into <body> using
 * fixed positioning, so it can NEVER be clipped by parent overflow, CSS
 * columns, or @dnd-kit transform stacking contexts.
 */
function Note(props) {
  const { id } = props;
  const isDark = props.color === "#232323";

  // -------------------------------------------------------------------
  // Global single-open-menu wiring (falls back to local state if the
  // parent didn't pass the new props, so the component still works).
  // -------------------------------------------------------------------
  const isMenuControlled = props.openMenuId !== undefined;
  const [localOpenMenu, setLocalOpenMenu] = useState(false);

  // "view" describes WHICH panel of the menu is showing:
  //   null | "root" | "color" | "category" | "export"
  const [menuView, setMenuView] = useState("root");

  const isMenuOpen = isMenuControlled
    ? props.openMenuId === id
    : localOpenMenu;

  // Anchor (the ⋮ button) + the floating panel
  const moreBtnRef = useRef(null);
  const menuPanelRef = useRef(null);

  // Fixed-position coordinates for the portal panel
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, ready: false });

  const speechState = props.speechState || {};
  const isSpeechActive = Boolean(speechState.isActive);
  const isSpeechReading = Boolean(speechState.isReading);

  const currentCategory = CATEGORIES.find(
    (c) => c.id === (props.category || "none")
  );

  // -------------------------------------------------------------------
  // Open / close helpers
  // -------------------------------------------------------------------
  const openMenu = useCallback(() => {
    setMenuView("root");
    if (isMenuControlled) {
      if (props.onOpenMenu) props.onOpenMenu(id);
    } else {
      setLocalOpenMenu(true);
    }
  }, [id, isMenuControlled, props]);

  const closeMenu = useCallback(() => {
    setMenuView("root");
    if (isMenuControlled) {
      if (props.onCloseMenu) props.onCloseMenu(id);
    } else {
      setLocalOpenMenu(false);
    }
  }, [id, isMenuControlled, props]);

  const toggleMenu = useCallback(() => {
    if (isMenuOpen) closeMenu();
    else openMenu();
  }, [isMenuOpen, openMenu, closeMenu]);

  // -------------------------------------------------------------------
  // Viewport-aware positioning of the floating panel.
  // Runs after the panel renders (so we know its real size) and on
  // scroll / resize while it's open. The panel is FIXED so it lives
  // in the viewport coordinate space and can never be clipped.
  // -------------------------------------------------------------------
  const positionMenu = useCallback(() => {
    const btn = moreBtnRef.current;
    const panel = menuPanelRef.current;
    if (!btn || !panel) return;

    const margin = 8;
    const btnRect = btn.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const panelW = panelRect.width || 200;
    const panelH = panelRect.height || 240;

    // Prefer opening ABOVE the button, right-aligned to it.
    let top = btnRect.top - panelH - margin;
    let left = btnRect.right - panelW;

    // Not enough room above? Open below instead.
    if (top < margin) {
      top = btnRect.bottom + margin;
    }

    // Still overflowing the bottom? Clamp upward.
    if (top + panelH > vh - margin) {
      top = Math.max(margin, vh - panelH - margin);
    }

    // Horizontal clamping so icons/text never spill off-screen.
    if (left + panelW > vw - margin) left = vw - panelW - margin;
    if (left < margin) left = margin;

    setMenuPos({ top, left, ready: true });
  }, []);

  // Measure & position when the menu opens or its view changes (size changes).
  useLayoutEffect(() => {
    if (!isMenuOpen) {
      setMenuPos((p) => (p.ready ? { ...p, ready: false } : p));
      return;
    }
    // First paint with ready:false (so it's invisible), then measure.
    positionMenu();
  }, [isMenuOpen, menuView, positionMenu]);

  // Reposition on scroll / resize while open; close on hard scroll containers.
  useEffect(() => {
    if (!isMenuOpen) return;

    function handleReposition() {
      positionMenu();
    }
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [isMenuOpen, positionMenu]);

  // -------------------------------------------------------------------
  // Outside click + Escape -> close
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!isMenuOpen) return;

    function handleClickOutside(e) {
      if (
        menuPanelRef.current &&
        !menuPanelRef.current.contains(e.target) &&
        moreBtnRef.current &&
        !moreBtnRef.current.contains(e.target)
      ) {
        closeMenu();
      }
    }

    function handleKeyDown(e) {
      if (e.key === "Escape") closeMenu();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen, closeMenu]);

  // -------------------------------------------------------------------
  // Action handlers — each one closes the menu after acting.
  // -------------------------------------------------------------------
  function stop(e) {
    e.stopPropagation();
  }

  function handleReadClick(e) {
    e.stopPropagation();
    closeMenu();
    if (props.onReadAloud) {
      props.onReadAloud(props.id, {
        title: props.title,
        content: props.content,
      });
    }
  }

  function handleMoreToggle(e) {
    e.stopPropagation();
    toggleMenu();
  }

  function handleEditClick(e) {
    e.stopPropagation();
    closeMenu();
    props.onEdit(props.id);
  }

  function handleColorSelect(e, hex) {
    e.stopPropagation();
    props.onColorChange(props.id, hex);
    closeMenu();
  }

  function handleCategorySelect(e, catId) {
    e.stopPropagation();
    props.onCategoryChange(props.id, catId);
    closeMenu();
  }

  function handleExport(e, format) {
    e.stopPropagation();
    if (props.onExport) props.onExport(props.id, format);
    closeMenu();
  }

  function handleDeleteClick(e) {
    e.stopPropagation();
    closeMenu();
    props.onDelete(props.id);
  }

  // -------------------------------------------------------------------
  // Render the floating menu panel (portaled to <body>)
  // -------------------------------------------------------------------
  function renderMenuPanel() {
    if (!isMenuOpen) return null;

    const panel = (
      <div
        ref={menuPanelRef}
        className={`note-menu-panel ${isDark ? "note-menu-panel-dark" : ""}`}
        role="menu"
        style={{
          top: menuPos.top,
          left: menuPos.left,
          visibility: menuPos.ready ? "visible" : "hidden",
        }}
        onMouseDown={stop}
        onPointerDown={stop}
        onTouchStart={stop}
        onClick={stop}
      >
        {menuView === "root" && (
          <>
            <button
              type="button"
              role="menuitem"
              className="note-menu-item"
              onClick={handleEditClick}
            >
              <span className="material-icons">edit</span>
              <span className="note-menu-label">Edit</span>
            </button>

            <button
              type="button"
              role="menuitem"
              className="note-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                setMenuView("color");
              }}
            >
              <span className="material-icons">palette</span>
              <span className="note-menu-label">Color</span>
              <span className="material-icons note-menu-chevron">
                chevron_right
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              className="note-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                setMenuView("category");
              }}
            >
              <span className="material-icons">label</span>
              <span className="note-menu-label">Category</span>
              <span className="material-icons note-menu-chevron">
                chevron_right
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              className="note-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                setMenuView("export");
              }}
            >
              <span className="material-icons">download</span>
              <span className="note-menu-label">Export</span>
              <span className="material-icons note-menu-chevron">
                chevron_right
              </span>
            </button>

            <div className="note-menu-divider" />

            <button
              type="button"
              role="menuitem"
              className="note-menu-item note-menu-item-danger"
              onClick={handleDeleteClick}
            >
              <span className="material-icons">delete</span>
              <span className="note-menu-label">Delete</span>
            </button>
          </>
        )}

        {menuView === "color" && (
          <>
            <button
              type="button"
              className="note-menu-back"
              onClick={(e) => {
                e.stopPropagation();
                setMenuView("root");
              }}
            >
              <span className="material-icons">chevron_left</span>
              <span>Color</span>
            </button>
            <div className="note-menu-colorgrid">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className="note-menu-colordot"
                  title={c.name}
                  style={{
                    background: c.hex,
                    border:
                      props.color === c.hex
                        ? "2px solid #1976d2"
                        : "2px solid rgba(0,0,0,0.12)",
                  }}
                  onClick={(e) => handleColorSelect(e, c.hex)}
                />
              ))}
            </div>
          </>
        )}

        {menuView === "category" && (
          <>
            <button
              type="button"
              className="note-menu-back"
              onClick={(e) => {
                e.stopPropagation();
                setMenuView("root");
              }}
            >
              <span className="material-icons">chevron_left</span>
              <span>Category</span>
            </button>
            <div className="note-menu-scroll">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="menuitem"
                  className={`note-menu-item ${
                    (props.category || "none") === cat.id
                      ? "note-menu-item-active"
                      : ""
                  }`}
                  onClick={(e) => handleCategorySelect(e, cat.id)}
                >
                  <span className="note-menu-emoji">{cat.emoji}</span>
                  <span className="note-menu-label">{cat.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {menuView === "export" && (
          <>
            <button
              type="button"
              className="note-menu-back"
              onClick={(e) => {
                e.stopPropagation();
                setMenuView("root");
              }}
            >
              <span className="material-icons">chevron_left</span>
              <span>Export</span>
            </button>
            {["pdf", "txt", "json"].map((format) => (
              <button
                key={format}
                type="button"
                role="menuitem"
                className="note-menu-item"
                onClick={(e) => handleExport(e, format)}
              >
                <span className="material-icons">description</span>
                <span className="note-menu-label">{format.toUpperCase()}</span>
              </button>
            ))}
          </>
        )}
      </div>
    );

    return createPortal(panel, document.body);
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
          color: props.isPinned ? "#f5ba13" : isDark ? "#888" : "#ccc",
        }}
      >
        <span className="material-icons">push_pin</span>
      </button>

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

      <h1 style={{ color: isDark ? "#fff" : "#333" }}>{props.title}</h1>

      <p style={{ color: isDark ? "#ccc" : "#555" }}>{props.content}</p>

      <VoiceNotePlayer voiceNote={props.voiceNote} isDark={isDark} />

      {isSpeechActive && (
        <div
          className={`reading-indicator ${
            isDark ? "reading-indicator-dark" : ""
          }`}
        >
          <span className="speaker-pulse" aria-hidden="true">
            🔊
          </span>
          <span>{isSpeechReading ? "Reading..." : "Paused"}</span>
        </div>
      )}

      {/* ===================== NOTE ACTIONS ===================== */}
      <div className="note-actions">
        {/* Read aloud */}
        <button
          className={`read-aloud-btn ${
            isSpeechActive ? "read-aloud-active" : ""
          }`}
          onClick={handleReadClick}
          onMouseDown={stop}
          onPointerDown={stop}
          onTouchStart={stop}
          title="Read aloud"
          aria-label={`${speechState.label || "Read"} note aloud`}
          style={{
            color: isSpeechActive ? "#f5ba13" : isDark ? "#ccc" : "#5f6368",
          }}
        >
          <span className="read-aloud-icon" aria-hidden="true">
            {speechState.icon || "🔊"}
          </span>
          <span className="read-aloud-label">
            {speechState.label || "Read"}
          </span>
        </button>

        {/* More (⋮) */}
        <button
          ref={moreBtnRef}
          className={`note-more-btn ${isMenuOpen ? "note-more-active" : ""}`}
          onClick={handleMoreToggle}
          onMouseDown={stop}
          onPointerDown={stop}
          onTouchStart={stop}
          title="More actions"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          style={{ color: isDark ? "#ccc" : "#5f6368" }}
        >
          <span className="material-icons">more_vert</span>
        </button>
      </div>
      {/* =================== END NOTE ACTIONS =================== */}

      {renderMenuPanel()}
    </div>
  );
}

export default Note;