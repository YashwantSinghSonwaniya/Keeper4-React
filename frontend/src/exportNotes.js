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

export function normalizeExportNotes(notes) {
  if (!Array.isArray(notes)) return [];

  return notes
    .filter((note) => note && typeof note === "object")
    .map((note) => {
      const normalized = {
        title: safeString(note.title),
        content: safeString(note.content),
        category: safeString(note.category || "none"),
        pinned: Boolean(note.is_pinned || note.isPinned || note.pinned),
        created_at: normalizeDate(note.created_at || note.createdAt),
        updated_at: normalizeDate(note.updated_at || note.updatedAt),
      };

      const voice = getVoiceMetadata(note);
      if (voice) {
        normalized.voice_note = voice;
      }

      return normalized;
    });
}

function formatDisplayDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safeString(value);
  return date.toISOString().slice(0, 10);
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

export function getExportFilename(format) {
  const date = new Date().toISOString().slice(0, 10);
  return `keeper-notes-${date}.${format}`;
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
