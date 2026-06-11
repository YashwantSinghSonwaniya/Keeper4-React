function safeString(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safeString(value);
  return date.toISOString();
}

function getVoiceMetadata(note) {
  const voiceNote = note.voice_note || note.voiceNote;
  if (!voiceNote || typeof voiceNote !== "object") return null;

  return {
    duration: voiceNote.duration ?? null,
    audio_url: voiceNote.audio_url || voiceNote.audioUrl || null,
  };
}

export function normalizeExportNote(note) {
  const source = note && typeof note === "object" ? note : {};
  const normalized = {
    title: safeString(source.title),
    content: safeString(source.content),
    category: safeString(source.category || "none"),
    pinned: Boolean(source.is_pinned || source.isPinned || source.pinned),
    created_at: normalizeDate(source.created_at || source.createdAt),
    updated_at: normalizeDate(source.updated_at || source.updatedAt),
  };

  const voice = getVoiceMetadata(source);
  if (voice) {
    normalized.voice_note = voice;
  }

  return normalized;
}

export function normalizeExportNotes(notes) {
  if (!Array.isArray(notes)) return [];

  return notes
    .filter((note) => note && typeof note === "object")
    .map((note) => normalizeExportNote(note));
}

function formatDisplayDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safeString(value);
  return date.toISOString().slice(0, 10);
}

function getSafeFilenamePart(value, fallback) {
  const safeValue = safeString(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return safeValue || fallback;
}

export function formatNotesAsTxt(notes) {
  const normalizedNotes = normalizeExportNotes(notes);

  if (normalizedNotes.length === 0) {
    return "No notes to export.";
  }

  return normalizedNotes
    .map((note) => {
      const lines = [
        "⸻",
        `Title: ${note.title || "Untitled"}`,
        `Category: ${note.category || "none"}`,
        `Date: ${formatDisplayDate(note.created_at || note.updated_at)}`,
        `Pinned: ${note.pinned ? "Yes" : "No"}`,
      ];

      if (note.voice_note) {
        lines.push(
          "Voice Note: Metadata only",
          `Voice Duration: ${note.voice_note.duration ?? "Not available"}`,
          `Voice Audio URL: ${note.voice_note.audio_url || "Not available"}`,
        );
      }

      lines.push("", "Content:", "", note.content || "", "⸻");
      return lines.join("\n");
    })
    .join("\n\n");
}

export function formatNotesAsJson(notes) {
  return JSON.stringify(normalizeExportNotes(notes), null, 2);
}

export function formatNoteAsTxt(note) {
  const normalized = normalizeExportNote(note);
  const lines = [
    `Title: ${normalized.title || "Untitled"}`,
    `Category: ${normalized.category || "none"}`,
    `Created: ${formatDisplayDate(normalized.created_at)}`,
    "",
    "Content:",
    "",
    normalized.content || "",
  ];

  if (normalized.voice_note) {
    lines.push(
      "",
      "Voice Note: Metadata only (raw audio not exported)",
      `Voice Duration: ${normalized.voice_note.duration ?? "Not available"}`,
      `Voice Audio URL: ${normalized.voice_note.audio_url || "Not available"}`,
    );
  }

  return lines.join("\n");
}

export function formatNoteAsJson(note) {
  return JSON.stringify(normalizeExportNote(note), null, 2);
}

export function getExportFilename(format) {
  const date = new Date().toISOString().slice(0, 10);
  return `keeper-notes-${date}.${format}`;
}

export function getNoteExportFilename(note, format) {
  const date = new Date().toISOString().slice(0, 10);
  const normalized = normalizeExportNote(note);
  const title = getSafeFilenamePart(normalized.title, "untitled-note");
  const extension = getSafeFilenamePart(format, "txt");

  return `keeper-note-${title}-${date}.${extension}`;
}

export function downloadTextFile({ content, filename, mimeType }) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
