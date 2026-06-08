import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import Header from "../components/Header";
import Footer from "../components/Footer";
import Note from "../components/Note";
import CreateArea from "../components/CreateArea";

import {
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  updateNoteColor,
  togglePinNote,
} from "../api";

function Home({ user, isLoggedIn, onLogout }) {
  const [notes, setNotes] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalNote, setModalNote] = useState({ title: "", content: "" });
  const [modalNoteId, setModalNoteId] = useState(null);
  const [modalColor, setModalColor] = useState("#ffffff");

  const formRef = useRef(null);

  // ✅ Load notes on mount or when login state changes
  useEffect(() => {
    async function loadNotes() {
      setLoading(true);
      if (isLoggedIn) {
        try {
          const res = await getNotes();
          setNotes(res.data);
        } catch (err) {
          console.error("Failed to load notes:", err.message);
        }
      } else {
        // Guest mode — use localStorage
        const saved = localStorage.getItem("notes_guest");
        setNotes(saved ? JSON.parse(saved) : []);
      }
      setLoading(false);
    }
    loadNotes();
  }, [isLoggedIn]);

  // ✅ Save guest notes to localStorage
  useEffect(() => {
    if (!isLoggedIn) {
      localStorage.setItem("notes_guest", JSON.stringify(notes));
    }
  }, [notes, isLoggedIn]);

  // ✅ Close modal on Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") closeModal();
    }
    if (modalOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [modalOpen]);

  const filteredNotes = notes.filter((note) => {
    const q = searchQuery.toLowerCase();
    const title = (note.title || "").toLowerCase();
    const content = (note.content || "").toLowerCase();
    return title.includes(q) || content.includes(q);
  });

  const pinnedNotes = filteredNotes.filter((n) => n.isPinned || n.is_pinned);
  const unpinnedNotes = filteredNotes.filter((n) => !n.isPinned && !n.is_pinned);

  // ✅ Add note
  async function addNote(newNote) {
    if (isLoggedIn) {
      try {
        const res = await createNote(newNote);
        setNotes((prev) => [res.data, ...prev]);
      } catch (err) {
        console.error("Failed to create note:", err.message);
      }
    } else {
      setNotes((prev) => [
        ...prev,
        { ...newNote, color: "#ffffff", isPinned: false },
      ]);
    }
  }

  // ✅ Delete note
  async function deleteNoteHandler(id) {
    if (isLoggedIn) {
      try {
        const note = notes.find((n) => n.id === id);
        await deleteNote(note.id);
        setNotes((prev) => prev.filter((n) => n.id !== id));
      } catch (err) {
        console.error("Failed to delete note:", err.message);
      }
    } else {
      setNotes((prev) =>
        prev.filter((_, index) => index !== id)
      );
    }
  }

  // ✅ Open edit modal
  function editNoteHandler(id) {
    const note = notes.find((n, index) =>
      isLoggedIn ? n.id === id : index === id
    );
    if (!note) return;

    setModalNoteId(isLoggedIn ? note.id : id);
    setModalNote({
      title: note.title || "",
      content: note.content || "",
    });
    setModalColor(note.color || "#ffffff");
    setModalOpen(true);
  }

  // ✅ Save modal
  async function saveModalNote() {
    if (
      modalNote.title.trim() === "" &&
      modalNote.content.trim() === ""
    ) return;

    if (isLoggedIn) {
      try {
        const res = await updateNote(modalNoteId, modalNote);
        setNotes((prev) =>
          prev.map((n) => (n.id === modalNoteId ? res.data : n))
        );
      } catch (err) {
        console.error("Failed to update note:", err.message);
      }
    } else {
      setNotes((prev) =>
        prev.map((note, index) =>
          index === modalNoteId ? { ...note, ...modalNote } : note
        )
      );
    }
    closeModal();
  }

  function closeModal() {
    setModalOpen(false);
    setModalNote({ title: "", content: "" });
    setModalNoteId(null);
  }

  function updateNoteHandler(updatedNote) {
    setNotes((prev) =>
      prev.map((note, index) =>
        index === editIndex ? { ...note, ...updatedNote } : note
      )
    );
    setIsEditing(false);
    setEditIndex(null);
  }

  // ✅ Change color
  async function changeNoteColor(id, color) {
    if (isLoggedIn) {
      try {
        const note = notes.find((n) => n.id === id);
        await updateNoteColor(note.id, color);
        setNotes((prev) =>
          prev.map((n) => (n.id === id ? { ...n, color } : n))
        );
      } catch (err) {
        console.error("Failed to update color:", err.message);
      }
    } else {
      setNotes((prev) =>
        prev.map((note, index) =>
          index === id ? { ...note, color } : note
        )
      );
    }
  }

  // ✅ Toggle pin
  async function togglePin(id) {
    if (isLoggedIn) {
      try {
        const note = notes.find((n) => n.id === id);
        const res = await togglePinNote(note.id);
        setNotes((prev) =>
          prev.map((n) => (n.id === id ? res.data : n))
        );
      } catch (err) {
        console.error("Failed to toggle pin:", err.message);
      }
    } else {
      setNotes((prev) =>
        prev.map((note, index) =>
          index === id
            ? { ...note, isPinned: !note.isPinned }
            : note
        )
      );
    }
  }

  function renderNote(noteItem, index) {
    const id = isLoggedIn ? noteItem.id : index;
    const isPinned = noteItem.is_pinned || noteItem.isPinned || false;

    return (
      <Note
        key={noteItem.id || index}
        id={id}
        title={noteItem.title}
        content={noteItem.content}
        color={noteItem.color || "#ffffff"}
        isPinned={isPinned}
        onDelete={deleteNoteHandler}
        onEdit={editNoteHandler}
        onColorChange={changeNoteColor}
        onPin={togglePin}
      />
    );
  }

  return (
    <div className="page-content">
      <Header isLoggedIn={isLoggedIn} user={user} onLogout={onLogout} />

      {!isLoggedIn && (
        <div className="guest-banner banner-c">
          <div className="guest-banner-left">
            <span className="banner-c-icon">🔒</span>
            <span className="banner-c-text">
              Guest mode — notes are{" "}
              <strong className="banner-c-highlight">not saved</strong>.{" "}
              <Link to="/login" className="banner-c-link">Sign in</Link>
              {" "}or{" "}
              <Link to="/register" className="banner-c-link">
                create a free account
              </Link>{" "}
              to keep them forever.
            </span>
          </div>
          <div className="guest-banner-actions">
            <Link to="/login" className="banner-btn banner-btn-solid">Sign in</Link>
            <Link to="/register" className="banner-btn banner-c-outline">Register</Link>
          </div>
        </div>
      )}

      <div ref={formRef}>
        <CreateArea
          onAdd={addNote}
          onUpdate={updateNoteHandler}
          isEditing={isEditing}
          editNote={{ title: "", content: "" }}
        />
      </div>

      {notes.length > 0 && (
        <div className="search-bar">
          <span className="material-icons search-icon">search</span>
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              className="search-clear"
              onClick={() => setSearchQuery("")}
            >
              <span className="material-icons">close</span>
            </button>
          )}
        </div>
      )}

      {searchQuery && filteredNotes.length === 0 && (
        <div className="no-results">
          <span className="material-icons">search_off</span>
          <p>No notes match "<strong>{searchQuery}</strong>"</p>
        </div>
      )}

      {loading ? (
        <div className="loading">
          <span className="material-icons loading-icon">hourglass_empty</span>
          <p>Loading notes...</p>
        </div>
      ) : (
        <>
          {pinnedNotes.length > 0 && (
            <div className="notes-section">
              <p className="section-label">
                <span className="material-icons">push_pin</span>
                Pinned
              </p>
              <div className="notes-grid">
                {pinnedNotes.map((note, i) => renderNote(note, i))}
              </div>
            </div>
          )}

          {pinnedNotes.length > 0 && unpinnedNotes.length > 0 && (
            <div className="section-divider">
              <span>Other notes</span>
            </div>
          )}

          {unpinnedNotes.length > 0 && (
            <div className="notes-section">
              {pinnedNotes.length === 0 && (
                <p className="section-label">
                  <span className="material-icons">notes</span>
                  Notes
                </p>
              )}
              <div className="notes-grid">
                {unpinnedNotes.map((note, i) => renderNote(note, i))}
              </div>
            </div>
          )}
        </>
      )}

      <Footer />

      {/* EDIT MODAL */}
      {modalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target.classList.contains("modal-overlay"))
              closeModal();
          }}
        >
          <div
            className="modal-card"
            style={{ background: modalColor }}
          >
            <div className="modal-header">
              <input
                className="modal-title-input"
                placeholder="Title"
                value={modalNote.title}
                onChange={(e) => {
                  const value = e.target.value;
                  setModalNote((prev) => ({ ...prev, title: value }));
                }}
              />
              <button className="modal-close-btn" onClick={closeModal}>
                <span className="material-icons">close</span>
              </button>
            </div>

            <textarea
              className="modal-content-input"
              placeholder="Take a note..."
              value={modalNote.content}
              autoFocus
              onChange={(e) => {
                const value = e.target.value;
                setModalNote((prev) => ({ ...prev, content: value }));
              }}
            />

            <div className="modal-footer">
              <button className="modal-cancel-btn" onClick={closeModal}>
                Cancel
              </button>
              <button className="modal-save-btn" onClick={saveModalNote}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;