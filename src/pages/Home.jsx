import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import Header from "../components/Header";
import Footer from "../components/Footer";
import Note from "../components/Note";
import CreateArea from "../components/CreateArea";

function Home({ user, isLoggedIn, onLogout }) {
  const [notes, setNotes] = useState(() => {
    const loggedInUser = localStorage.getItem("loggedInUser");
    const key = loggedInUser
      ? `notes_${JSON.parse(loggedInUser).email}`
      : "notes_guest";
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // ✅ Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalNote, setModalNote] = useState({ title: "", content: "" });
  const [modalIndex, setModalIndex] = useState(null);

  const formRef = useRef(null);

  useEffect(() => {
    const key = isLoggedIn ? `notes_${user?.email}` : "notes_guest";
    localStorage.setItem(key, JSON.stringify(notes));
  }, [notes, isLoggedIn, user]);

  useEffect(() => {
    const key = isLoggedIn ? `notes_${user?.email}` : "notes_guest";
    const saved = localStorage.getItem(key);
    setNotes(saved ? JSON.parse(saved) : []);
  }, [isLoggedIn, user]);

  // ✅ Close modal on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") closeModal();
    }
    if (modalOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // ✅ Prevent background scrolling when modal open
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [modalOpen]);

  const filteredNotes = notes.filter((note) => {
    const q = searchQuery.toLowerCase();
    return (
      note.title.toLowerCase().includes(q) ||
      note.content.toLowerCase().includes(q)
    );
  });

  const pinnedNotes = filteredNotes.filter((n) => n.isPinned);
  const unpinnedNotes = filteredNotes.filter((n) => !n.isPinned);

  function addNote(newNote) {
    setNotes((prevNotes) => [
      ...prevNotes,
      { ...newNote, color: "#ffffff", isPinned: false },
    ]);
  }

  function deleteNote(id) {
    setNotes((prevNotes) =>
      prevNotes.filter((noteItem, index) => index !== id)
    );
  }

  // ✅ Open modal instead of scrolling to form
  function editNote(id) {
    setModalIndex(id);
    setModalNote({
      title: notes[id].title,
      content: notes[id].content,
    });
    setModalOpen(true);
  }

  // ✅ Save from modal
  function saveModalNote() {
    if (modalNote.title.trim() === "" && modalNote.content.trim() === "")
      return;

    setNotes((prevNotes) =>
      prevNotes.map((note, index) =>
        index === modalIndex ? { ...note, ...modalNote } : note
      )
    );
    closeModal();
  }

  // ✅ Close modal
  function closeModal() {
    setModalOpen(false);
    setModalNote({ title: "", content: "" });
    setModalIndex(null);
  }

  function updateNote(updatedNote) {
    setNotes((prevNotes) =>
      prevNotes.map((note, index) =>
        index === editIndex ? { ...note, ...updatedNote } : note
      )
    );
    setIsEditing(false);
    setEditIndex(null);
  }

  function changeNoteColor(id, color) {
    setNotes((prevNotes) =>
      prevNotes.map((note, index) => (index === id ? { ...note, color } : note))
    );
  }

  function togglePin(id) {
    setNotes((prevNotes) =>
      prevNotes.map((note, index) =>
        index === id ? { ...note, isPinned: !note.isPinned } : note
      )
    );
  }

  function renderNote(noteItem) {
    const realIndex = notes.indexOf(noteItem);
    return (
      <Note
        key={realIndex}
        id={realIndex}
        title={noteItem.title}
        content={noteItem.content}
        color={noteItem.color || "#ffffff"}
        isPinned={noteItem.isPinned || false}
        onDelete={deleteNote}
        onEdit={editNote}
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
              <Link to="/login" className="banner-c-link">
                Sign in
              </Link>{" "}
              or{" "}
              <Link to="/register" className="banner-c-link">
                create a free account
              </Link>{" "}
              to keep them forever.
            </span>
          </div>
          <div className="guest-banner-actions">
            <Link to="/login" className="banner-btn banner-btn-solid">
              Sign in
            </Link>
            <Link to="/register" className="banner-btn banner-c-outline">
              Register
            </Link>
          </div>
        </div>
      )}

      <div ref={formRef}>
        <CreateArea
          onAdd={addNote}
          onUpdate={updateNote}
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
            <button className="search-clear" onClick={() => setSearchQuery("")}>
              <span className="material-icons">close</span>
            </button>
          )}
        </div>
      )}

      {searchQuery && filteredNotes.length === 0 && (
        <div className="no-results">
          <span className="material-icons">search_off</span>
          <p>
            No notes match "<strong>{searchQuery}</strong>"
          </p>
        </div>
      )}

      {pinnedNotes.length > 0 && (
        <div className="notes-section">
          <p className="section-label">
            <span className="material-icons">push_pin</span>
            Pinned
          </p>
          <div className="notes-grid">{pinnedNotes.map(renderNote)}</div>
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
          <div className="notes-grid">{unpinnedNotes.map(renderNote)}</div>
        </div>
      )}

      <Footer />

      {/* ✅ EDIT MODAL */}
      {modalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target.classList.contains("modal-overlay")) closeModal();
          }}
        >
          <div
            className="modal-card"
            style={{
              background: notes[modalIndex]?.color || "#ffffff",
            }}
          >
            {/* Modal header */}
            <div className="modal-header">
              <input
                className="modal-title-input"
                placeholder="Title"
                value={modalNote.title}
                onChange={(e) => {
                  const value = e.target.value; // ✅ extract value immediately
                  setModalNote((prev) => ({
                    ...prev,
                    title: value,
                  }));
                }}
              />
              <button
                className="modal-close-btn"
                onClick={closeModal}
                title="Close"
              >
                <span className="material-icons">close</span>
              </button>
            </div>

            {/* Modal content */}
            <textarea
              className="modal-content-input"
              placeholder="Take a note..."
              value={modalNote.content}
              autoFocus
              onChange={(e) => {
                const value = e.target.value; // ✅ extract value immediately
                setModalNote((prev) => ({
                  ...prev,
                  content: value,
                }));
              }}
            />

            {/* Modal footer */}
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
