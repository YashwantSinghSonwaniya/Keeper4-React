import React, { useState, useEffect } from "react";

const addSound = new Audio("/sounds/addNote.wav");
const warningSound = new Audio("/sounds/warningSound.mp3");

function CreateArea(props) {
  const [titleName, setTitleName] = useState({
    title: "",
    content: "",
  });
  const [isExpanded, setExpanded] = useState(false);
  const [error, setError] = useState("");

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

  function submitNote(event) {
    event.preventDefault();

    if (
      titleName.title.trim() === "" &&
      titleName.content.trim() === ""
    ) {
      warningSound.currentTime = 0;
      warningSound.play();
      setError("⚠️ Title or content is required.");
      return;
    }

    setError("");
    addSound.currentTime = 0;
    addSound.play();

    if (props.isEditing) {
      props.onUpdate(titleName);
    } else {
      props.onAdd(titleName);
    }

    setTitleName({ title: "", content: "" });
    setExpanded(false);
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
        <button type="submit">
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