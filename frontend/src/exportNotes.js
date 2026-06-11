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

function escapeHtml(value) {
  return safeString(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDurationSeconds(value) {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  const duration = Number(value);
  if (Number.isNaN(duration)) {
    return `${safeString(value)} seconds`;
  }

  return `${Math.round(duration)} seconds`;
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

export function buildNotePdfHtml(note) {
  const [normalizedNote] = normalizeExportNotes([note]);

  if (!normalizedNote) {
    throw new Error("No note available to export.");
  }

  const title = normalizedNote.title || "Untitled";
  const category = normalizedNote.category || "none";
  const createdDate = formatDisplayDate(normalizedNote.created_at);
  const updatedDate = formatDisplayDate(normalizedNote.updated_at);
  const content = normalizedNote.content || "";
  const voiceNoteHtml = normalizedNote.voice_note
    ? `
      <section class="voice-note">
        <h2>Voice Note Attached</h2>
        <p><strong>Duration:</strong> ${escapeHtml(
          formatDurationSeconds(normalizedNote.voice_note.duration),
        )}</p>
      </section>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)} - Keeper Note</title>
    <style>
      @page { margin: 0.75in; }
      * { box-sizing: border-box; }
      body {
        color: #202124;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        margin: 0;
      }
      main { max-width: 760px; margin: 0 auto; }
      h1 {
        border-bottom: 2px solid #f5ba13;
        font-size: 28px;
        line-height: 1.2;
        margin: 0 0 20px;
        padding-bottom: 12px;
      }
      dl {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 8px 16px;
        margin: 0 0 24px;
      }
      dt { color: #5f6368; font-weight: 700; }
      dd { margin: 0; }
      h2 {
        color: #5f6368;
        font-size: 14px;
        letter-spacing: 0.08em;
        margin: 0 0 8px;
        text-transform: uppercase;
      }
      .content, .voice-note {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        margin-top: 16px;
        padding: 16px;
      }
      .note-content {
        margin: 0;
        min-height: 120px;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .voice-note p { margin: 0; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <dl>
        <dt>Category</dt>
        <dd>${escapeHtml(category)}</dd>
        <dt>Created date</dt>
        <dd>${escapeHtml(createdDate)}</dd>
        <dt>Updated date</dt>
        <dd>${escapeHtml(updatedDate)}</dd>
      </dl>
      <section class="content">
        <h2>Content</h2>
        <p class="note-content">${escapeHtml(content)}</p>
      </section>
      ${voiceNoteHtml}
    </main>
  </body>
</html>`;
}

export function printNoteAsPdf(note) {
  const html = buildNotePdfHtml(note);
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    throw new Error("Unable to open the print window.");
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  const printPdf = () => {
    printWindow.print();
  };

  if (printWindow.document.readyState === "complete") {
    printPdf();
  } else {
    printWindow.addEventListener("load", printPdf, { once: true });
  }
}
