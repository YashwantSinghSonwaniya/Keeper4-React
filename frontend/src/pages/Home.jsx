import toast from "react-hot-toast";
import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import Header from "../components/Header";
import Footer from "../components/Footer";
import Note from "../components/Note";
import CreateArea from "../components/CreateArea";
import GuestVoiceUpgradeModal from "../components/GuestVoiceUpgradeModal";

import {
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  updateNoteColor,
  togglePinNote,
  reorderNotes,
  importNotes,
  uploadVoiceNote,
} from "../api";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import SortableNote from "../components/SortableNote";
import GuestImportModal from "../components/GuestImportModal";

import { updateCategory } from "../api";
import CATEGORIES from "../categories";

function Home({ user, isLoggedIn, onLogout }) {
  const [notes, setNotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalNote, setModalNote] = useState({ title: "", content: "" });
  const [modalNoteId, setModalNoteId] = useState(null);
  const [modalColor, setModalColor] = useState("#ffffff");

  const [deleteConfirm, setDeleteConfirm] = useState({
    open: false,
    noteId: null,
  });

  const [skipDeleteConfirm, setSkipDeleteConfirm] = useState(
    localStorage.getItem("skipDeleteConfirm") === "true",
  );

  const formRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const [activeCategory, setActiveCategory] = useState("all");
  const [showGuestImportModal, setShowGuestImportModal] = useState(false);
  const [guestNotesToImport, setGuestNotesToImport] = useState([]);
  const [deleteGuestNotesAfterImport, setDeleteGuestNotesAfterImport] = useState(true);
  const [disableGuestImportPrompt, setDisableGuestImportPrompt] = useState(false);
  const [guestImportLoading, setGuestImportLoading] = useState(false);
  const [showGuestVoiceUpgrade, setShowGuestVoiceUpgrade] = useState(false);

  function getGuestPromptUserKey() {
    if (!user) return null;
    if (user.id) return `user_${user.id}`;
    return `user_${encodeURIComponent(user.email || "unknown")}`;
  }

  function getGuestPromptLastTimestampKey(userKey) {
    return `lastGuestImportPrompt_${userKey}`;
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

  function getGuestNotesFromStorage() {
    const saved = localStorage.getItem("notes_guest");
    if (!saved) return [];

    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
    } catch (err) {
      console.error("Could not parse guest notes:", err);
      localStorage.removeItem("notes_guest");
      return [];
    }
  }

  // ✅ KEY FIX — section-aware drag handler with unique prefixed IDs
  async function handleDragEnd(event, section) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // ✅ Only work on the dragged section's notes
    const sectionNotes = section === "pinned" ? pinnedNotes : unpinnedNotes;

    let oldIndex, newIndex;

    if (isLoggedIn) {
      oldIndex = sectionNotes.findIndex((n) => n.id === active.id);
      newIndex = sectionNotes.findIndex((n) => n.id === over.id);
    } else {
      // Guest: active.id is prefixed like "pinned-0" or "unpinned-1"
      const oldIdStr = String(active.id).split("-")[1];
      const newIdStr = String(over.id).split("-")[1];
      oldIndex = parseInt(oldIdStr, 10);
      newIndex = parseInt(newIdStr, 10);
    }

    if (oldIndex === -1 || newIndex === -1) return;

    // ✅ Reorder only within this section
    const reorderedSection = arrayMove(sectionNotes, oldIndex, newIndex);

    // ✅ Merge back — pinned always first, unpinned after
    const newNotes =
      section === "pinned"
        ? [...reorderedSection, ...unpinnedNotes]
        : [...pinnedNotes, ...reorderedSection];

    setNotes(newNotes);

    if (isLoggedIn) {
      try {
        await reorderNotes({ orderedIds: newNotes.map((n) => n.id) });
      } catch (err) {
        console.error("Failed to save order:", err.message);
        toast.error("Failed to save note order.");
      }
    } else {
      localStorage.setItem("notes_guest", JSON.stringify(newNotes));
    }
  }

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
      const saved = localStorage.getItem("notes_guest");
      setNotes(saved ? JSON.parse(saved) : []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadNotes();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      localStorage.setItem("notes_guest", JSON.stringify(notes));
    }
  }, [notes, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !user) return;

    const userKey = getGuestPromptUserKey();
    if (!userKey) return;

    const pending =
      sessionStorage.getItem(getGuestImportPromptPendingKey(userKey)) === "true";
    const handled =
      sessionStorage.getItem(getGuestImportPromptHandledKey(userKey)) === "true";
    const disabledLocal =
      localStorage.getItem(getGuestPromptDisabledKey(userKey)) === "true";
    const imported =
      localStorage.getItem(`guestNotesImported_${userKey}`) === "true";

    if (!pending || handled || disabledLocal || imported) return;

    const guestNotes = getGuestNotesFromStorage();
    if (guestNotes.length === 0) return;

    const lastPrompt = Number(
      localStorage.getItem(getGuestPromptLastTimestampKey(userKey)) || "0",
    );
    const hasWaited24H = Date.now() - lastPrompt >= 24 * 60 * 60 * 1000;
    const shouldPrompt = lastPrompt === 0 || hasWaited24H;
    if (!shouldPrompt) return;

    setGuestNotesToImport(guestNotes);
    setShowGuestImportModal(true);
    sessionStorage.setItem(getGuestImportPromptHandledKey(userKey), "true");
  }, [isLoggedIn, user]);

  useEffect(() => {
    if (!user) return;
    const userKey = getGuestPromptUserKey();
    if (!userKey) return;
    setDisableGuestImportPrompt(
      localStorage.getItem(getGuestPromptDisabledKey(userKey)) === "true",
    );
  }, [user]);

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
    const matchesSearch = title.includes(q) || content.includes(q);
    const matchesCategory =
      activeCategory === "all" || (note.category || "none") === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const pinnedNotes = filteredNotes.filter((n) => n.isPinned || n.is_pinned);
  const unpinnedNotes = filteredNotes.filter(
    (n) => !n.isPinned && !n.is_pinned,
  );

  async function addNote(newNote, voiceRecording) {
    if (isLoggedIn) {
      try {
        const res = await createNote(newNote);
        let savedNote = res.data;

        if (voiceRecording?.blob) {
          try {
            const voiceRes = await uploadVoiceNote(savedNote.id, voiceRecording);
            savedNote = {
              ...savedNote,
              voice_note: voiceRes.data.voice_note,
            };
            toast.success("Note with voice added!");
          } catch (err) {
            console.error("Failed to upload voice note:", err);
            toast.error(
              err.response?.data?.error ||
                "Note saved, but voice note upload failed.",
            );
          }
        } else {
          toast.success("Note added!");
        }

        setNotes((prev) => [savedNote, ...prev]);
        return true;
      } catch (err) {
        toast.error("Failed to add note.");
        return false;
      }
    } else {
      setNotes((prev) => [
        { ...newNote, color: "#ffffff", isPinned: false },
        ...prev,
      ]);
      toast.success("Note added!");
      return true;
    }
  }

  function confirmDelete(id) {
    if (skipDeleteConfirm) {
      actuallyDelete(id);
    } else {
      setDeleteConfirm({ open: true, noteId: id });
    }
  }

  async function actuallyDelete(id) {
    const sound = new Audio("/sounds/deleteButton.wav");
    sound.currentTime = 0;
    sound.play();
    setDeleteConfirm({ open: false, noteId: null });

    if (isLoggedIn) {
      try {
        await deleteNote(id);
        setNotes((prev) => prev.filter((n) => n.id !== id));
        toast.success("Note deleted!");
      } catch (err) {
        toast.error("Failed to delete note.");
      }
    } else {
      // ✅ FIX: Decode prefixed ID ("pinned-5" or "unpinned-3") to get global index
      const globalIndex = parseInt(String(id).split("-")[1], 10);
      setNotes((prev) => prev.filter((_, index) => index !== globalIndex));
      toast.success("Note deleted!");
    }
  }

  function editNoteHandler(id) {
    let note;
    if (isLoggedIn) {
      note = notes.find((n) => n.id === id);
    } else {
      // ✅ FIX: Decode prefixed ID ("pinned-5" or "unpinned-3") to get global index
      const globalIndex = parseInt(String(id).split("-")[1], 10);
      note = notes[globalIndex];
    }
    if (!note) return;
    setModalNoteId(id);
    setModalNote({ title: note.title || "", content: note.content || "" });
    setModalColor(note.color || "#ffffff");
    setModalOpen(true);
  }

  async function saveModalNote() {
    if (modalNote.title.trim() === "" && modalNote.content.trim() === "")
      return;

    if (isLoggedIn) {
      try {
        const res = await updateNote(modalNoteId, modalNote);
        setNotes((prev) =>
          prev.map((n) => (n.id === modalNoteId ? res.data : n)),
        );
        toast.success("Note updated!");
      } catch (err) {
        toast.error("Failed to update note.");
      }
    } else {
      // ✅ FIX: Decode prefixed ID ("pinned-5" or "unpinned-3") to get global index
      const globalIndex = parseInt(String(modalNoteId).split("-")[1], 10);
      setNotes((prev) =>
        prev.map((note, index) =>
          index === globalIndex ? { ...note, ...modalNote } : note,
        ),
      );
      toast.success("Note updated!");
    }
    closeModal();
  }

  function closeModal() {
    setModalOpen(false);
    setModalNote({ title: "", content: "" });
    setModalNoteId(null);
  }

  async function handleImportGuestNotes() {
    if (guestNotesToImport.length === 0) return;
    setGuestImportLoading(true);

    const userKey = getGuestPromptUserKey();

    try {
      const notesToImport = guestNotesToImport.map((note, index) => ({
        title: note.title || "",
        content: note.content || "",
        color: note.color || "#ffffff",
        is_pinned: note.isPinned || note.is_pinned || false,
        category: note.category || "none",
        position: index,
      }));

      await importNotes(notesToImport);
      if (disableGuestImportPrompt && userKey) {
        localStorage.setItem(getGuestPromptDisabledKey(userKey), "true");
      }
      if (deleteGuestNotesAfterImport) {
        localStorage.removeItem("notes_guest");
      }
      if (userKey) {
        localStorage.setItem(`guestNotesImported_${userKey}`, "true");
        localStorage.setItem(
          getGuestPromptLastTimestampKey(userKey),
          Date.now().toString(),
        );
        sessionStorage.setItem(getGuestImportPromptPendingKey(userKey), "false");
      }
      toast.success(`Imported ${guestNotesToImport.length} notes successfully`);
      await loadNotes();
    } catch (err) {
      console.error("Import guest notes failed:", err);
      toast.error("Failed to import guest notes.");
    } finally {
      setGuestImportLoading(false);
      setShowGuestImportModal(false);
    }
  }

  function handleSkipGuestImport() {
    const userKey = getGuestPromptUserKey();
    if (disableGuestImportPrompt && userKey) {
      localStorage.setItem(getGuestPromptDisabledKey(userKey), "true");
    }
    if (userKey) {
      localStorage.setItem(
        getGuestPromptLastTimestampKey(userKey),
        Date.now().toString(),
      );
      sessionStorage.setItem(getGuestImportPromptPendingKey(userKey), "false");
    }
    setShowGuestImportModal(false);
  }

  function handleToggleDeleteAfterImport() {
    setDeleteGuestNotesAfterImport((prev) => !prev);
  }

  function handleToggleDisablePrompt() {
    const userKey = getGuestPromptUserKey();
    if (!userKey) return;

    setDisableGuestImportPrompt((prev) => {
      const next = !prev;
      localStorage.setItem(getGuestPromptDisabledKey(userKey), next ? "true" : "false");
      return next;
    });
  }

  async function changeNoteColor(id, color) {
    if (isLoggedIn) {
      try {
        await updateNoteColor(id, color);
        setNotes((prev) =>
          prev.map((n) => (n.id === id ? { ...n, color } : n)),
        );
        toast.success("Color updated!");
      } catch (err) {
        toast.error("Failed to update color.");
      }
    } else {
      // ✅ FIX: Decode prefixed ID ("pinned-5" or "unpinned-3") to get global index
      const globalIndex = parseInt(String(id).split("-")[1], 10);
      setNotes((prev) =>
        prev.map((note, index) => (index === globalIndex ? { ...note, color } : note)),
      );
      toast.success("Color updated!");
    }
  }

  async function togglePin(id) {
    if (isLoggedIn) {
      try {
        const res = await togglePinNote(id);
        setNotes((prev) => prev.map((n) => (n.id === id ? res.data : n)));
        toast.success(
          res.data.is_pinned ? "Note pinned! 📌" : "Note unpinned!",
        );
      } catch (err) {
        toast.error("Failed to update pin.");
      }
    } else {
      // ✅ FIX: Decode prefixed ID ("pinned-5" or "unpinned-3") to get global index
      const globalIndex = parseInt(String(id).split("-")[1], 10);
      const note = notes[globalIndex];
      setNotes((prev) =>
        prev.map((n, index) =>
          index === globalIndex ? { ...n, isPinned: !n.isPinned } : n,
        ),
      );
      toast.success(!note.isPinned ? "Note pinned! 📌" : "Note unpinned!");
    }
  }

  // ✅ Helper to find global index in full notes array (for guest mode)
  function getGlobalNoteIndex(noteItem) {
    return notes.findIndex(
      (n) => n.title === noteItem.title && n.content === noteItem.content && n.color === noteItem.color
    );
  }

  // ✅ renderNote: use SortableNote when logged in, plain Note for guests
  function renderNote(noteItem, sectionIndex, section) {
    let id;
    if (isLoggedIn) {
      id = noteItem.id;
    } else {
      const globalIndex = getGlobalNoteIndex(noteItem);
      id = `${section}-${globalIndex}`;
    }
    const isPinned = noteItem.is_pinned || noteItem.isPinned || false;

    if (isLoggedIn) {
      return (
        <SortableNote
          key={noteItem.id}
          id={id}
          title={noteItem.title}
          content={noteItem.content}
          color={noteItem.color || "#ffffff"}
          isPinned={isPinned}
          category={noteItem.category || "none"}
          voiceNote={noteItem.voice_note}
          onDelete={confirmDelete}
          onEdit={editNoteHandler}
          onColorChange={changeNoteColor}
          onPin={togglePin}
          onCategoryChange={changeCategory}
        />
      );
    }

    // Guest mode: render plain Note (no drag/drop)
    return (
      <Note
        key={`note-${section}-${sectionIndex}`}
        id={id}
        title={noteItem.title}
        content={noteItem.content}
        color={noteItem.color || "#ffffff"}
        isPinned={isPinned}
        category={noteItem.category || "none"}
        voiceNote={noteItem.voice_note}
        onDelete={confirmDelete}
        onEdit={editNoteHandler}
        onColorChange={changeNoteColor}
        onPin={togglePin}
        onCategoryChange={changeCategory}
      />
    );
  }

  async function changeCategory(id, category) {
    if (isLoggedIn) {
      try {
        await updateCategory(id, category);
        setNotes((prev) =>
          prev.map((n) => (n.id === id ? { ...n, category } : n)),
        );
      } catch (err) {
        toast.error("Failed to update category.");
      }
    } else {
      // ✅ FIX: Decode prefixed ID ("pinned-5" or "unpinned-3") to get global index
      const globalIndex = parseInt(String(id).split("-")[1], 10);
      setNotes((prev) =>
        prev.map((note, index) =>
          index === globalIndex ? { ...note, category } : note,
        ),
      );
    }
  }

  return (
    <div className="page-content">
      <Header isLoggedIn={isLoggedIn} user={user} onLogout={onLogout} />

      {!isLoggedIn && (
        <div className="guest-banner banner-c">
          <div className="guest-banner-left">
            <span className="banner-c-icon">
              <span role="img" aria-label="lock">
                🔒
              </span>
            </span>
            <div className="guest-banner-text-group">
              <span className="banner-c-text">
                <strong className="banner-c-highlight">Guest mode</strong> —
                Your notes are saved in this browser only.
              </span>
              <span className="banner-c-subtext">
                <span role="img" aria-label="warning">
                  ⚠️
                </span>{" "}
                Clearing browser data will permanently delete your notes.{" "}
                <Link to="/register" className="banner-c-link">
                  Create a free account
                </Link>{" "}
                or{" "}
                <Link to="/login" className="banner-c-link">
                  sign in
                </Link>{" "}
                to keep them safe across all devices.
              </span>
            </div>
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
          onUpdate={() => {}}
          isEditing={false}
          editNote={{ title: "", content: "" }}
          isLoggedIn={isLoggedIn}
          onGuestVoiceAction={() => setShowGuestVoiceUpgrade(true)}
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

      {/* ✅ Category filter bar */}
      {notes.length > 0 && (
        <div className="category-filter-bar">
          <button
            className={`category-filter-btn ${
              activeCategory === "all" ? "category-filter-active" : ""
            }`}
            onClick={() => setActiveCategory("all")}
          >
            All
          </button>
          {CATEGORIES.filter((c) => c.id !== "none").map((cat) => (
            <button
              key={cat.id}
              className={`category-filter-btn ${
                activeCategory === cat.id ? "category-filter-active" : ""
              }`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading">
          <span className="material-icons loading-icon">hourglass_empty</span>
          <p>Loading notes...</p>
        </div>
      ) : (
        <>
          {/* ✅ PINNED — own DndContext */}
          {pinnedNotes.length > 0 && (
            <div className="notes-section">
              <p className="section-label">
                <span className="material-icons">push_pin</span>
                Pinned
              </p>
              {isLoggedIn ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => handleDragEnd(e, "pinned")}
                >
                  <SortableContext
                    items={pinnedNotes.map((n, i) => (isLoggedIn ? n.id : `pinned-${i}`))}
                    strategy={rectSortingStrategy}
                  >
                    <div className="notes-grid">
                      {pinnedNotes.map((note, i) => renderNote(note, i, "pinned"))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="notes-grid">
                  {pinnedNotes.map((note, i) => renderNote(note, i, "pinned"))}
                </div>
              )}
            </div>
          )}

          {pinnedNotes.length > 0 && unpinnedNotes.length > 0 && (
            <div className="section-divider">
              <span>Other notes</span>
            </div>
          )}

          {/* ✅ UNPINNED — own DndContext */}
          {unpinnedNotes.length > 0 && (
            <div className="notes-section">
              {pinnedNotes.length === 0 && (
                <p className="section-label">
                  <span className="material-icons">notes</span>
                  Notes
                </p>
              )}
              {isLoggedIn ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => handleDragEnd(e, "unpinned")}
                >
                  <SortableContext
                    items={unpinnedNotes.map((n, i) => (isLoggedIn ? n.id : `unpinned-${i}`))}
                    strategy={rectSortingStrategy}
                  >
                    <div className="notes-grid">
                      {unpinnedNotes.map((note, i) => renderNote(note, i, "unpinned"))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="notes-grid">
                  {unpinnedNotes.map((note, i) => renderNote(note, i, "unpinned"))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <GuestImportModal
        open={showGuestImportModal}
        count={guestNotesToImport.length}
        deleteAfterImport={deleteGuestNotesAfterImport}
        disablePrompt={disableGuestImportPrompt}
        onToggleDeleteAfterImport={handleToggleDeleteAfterImport}
        onToggleDisablePrompt={handleToggleDisablePrompt}
        onImport={handleImportGuestNotes}
        onLater={handleSkipGuestImport}
        loading={guestImportLoading}
      />

      <GuestVoiceUpgradeModal
        open={showGuestVoiceUpgrade}
        onClose={() => setShowGuestVoiceUpgrade(false)}
      />

      <Footer />

      {/* EDIT MODAL */}
      {modalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target.classList.contains("modal-overlay")) closeModal();
          }}
        >
          <div className="modal-card" style={{ background: modalColor }}>
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

      {/* DELETE CONFIRMATION */}
      {deleteConfirm.open && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target.classList.contains("modal-overlay"))
              setDeleteConfirm({ open: false, noteId: null });
          }}
        >
          <div className="confirm-modal">
            <div className="confirm-icon">
              <span role="img" aria-label="trash">
                🗑️
              </span>
            </div>
            <h3 className="confirm-title">Delete this note?</h3>
            <p className="confirm-text">This action cannot be undone.</p>
            <label className="confirm-skip-label">
              <input
                type="checkbox"
                checked={skipDeleteConfirm}
                onChange={(e) => {
                  setSkipDeleteConfirm(e.target.checked);
                  localStorage.setItem("skipDeleteConfirm", e.target.checked);
                }}
              />
              <span>Don't ask me again</span>
            </label>
            <div className="confirm-actions">
              <button
                className="confirm-cancel-btn"
                onClick={() => setDeleteConfirm({ open: false, noteId: null })}
              >
                Cancel
              </button>
              <button
                className="confirm-delete-btn"
                onClick={() => actuallyDelete(deleteConfirm.noteId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
