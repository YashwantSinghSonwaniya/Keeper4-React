import React, { useState, useEffect } from "react";
import VoiceRecorder from "./VoiceRecorder";

const addSound = new Audio("/sounds/addNote.wav");
const warningSound = new Audio("/sounds/warningSound.mp3");

function CreateArea(props) {
  const [titleName, setTitleName] = useState({
    title: "",
    content: "",
  });
  const [isExpanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const [voiceRecording, setVoiceRecording] = useState(null);
  const [recorderKey, setRecorderKey] = useState(0);
  const [saving, setSaving] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    // ✅ No limit — just update freely
    setTitleName((prevValue) => ({
      ...prevValue,
      [name]: value,
    }));
  }

  function expand() {
    setExpanded(true);
  }

  useEffect(() => {
    if (props.isEditing) {
      setTitleName(props.editNote);
      setExpanded(true);
    }
  }, [props.isEditing, props.editNote]);

  async function submitNote(event) {
    event.preventDefault();

    const hasText =
      titleName.title.trim() !== "" || titleName.content.trim() !== "";
    const hasVoice = Boolean(voiceRecording?.blob);

    if (
      !hasText &&
      !hasVoice
    ) {
      warningSound.currentTime = 0;
      warningSound.play();
      setError("Title, content, or a voice note is required.");
      return;
    }

    setError("");
    setSaving(true);

    try {
      const saved = props.isEditing
        ? await props.onUpdate(titleName)
        : await props.onAdd(titleName, voiceRecording);

      if (saved === false) return;

      addSound.currentTime = 0;
      addSound.play();
      setTitleName({ title: "", content: "" });
      setVoiceRecording(null);
      setRecorderKey((prev) => prev + 1);
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  }

  const charCount = titleName.content.length;
  const titleCount = titleName.title.length;

  return (
    <form onSubmit={submitNote} className="create-note-form">
      {isExpanded && (
        <>
          <input
            onChange={handleChange}
            name="title"
            value={titleName?.title || ""}
            placeholder="Title"
          />
          {/* ✅ Title counter */}
          <p className="char-counter">
            {titleCount} chars
          </p>
        </>
      )}

      <textarea
        onClick={expand}
        onChange={handleChange}
        name="content"
        value={titleName?.content || ""}
        placeholder="Take a note..."
        rows={isExpanded ? 3 : 1}
      />

      {/* ✅ Content counter — no limit, just informational */}
      {isExpanded && (
        <p className="char-counter">
          {charCount} {charCount === 1 ? "character" : "characters"}
        </p>
      )}

      {isExpanded && (
        <div className="create-voice-row">
          <VoiceRecorder
            key={recorderKey}
            isLoggedIn={props.isLoggedIn}
            onRecordingComplete={setVoiceRecording}
            onRecordingDelete={() => setVoiceRecording(null)}
            onGuestAction={props.onGuestVoiceAction}
            disabled={saving}
          />
        </div>
      )}

      {isExpanded && (
        <button type="submit" className="create-submit-btn" disabled={saving}>
          <span className="material-icons">
            {props.isEditing ? "edit" : "add"}
          </span>
        </button>
      )}

      {error && <p className="error">{error}</p>}
    </form>
  );
}

export default CreateArea;
