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

function sanitizePdfText(value) {
  return safeString(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      return code === 9 ||
        code === 10 ||
        code === 13 ||
        (code >= 32 && code <= 126)
        ? char
        : "?";
    })
    .join("");
}

function wrapPdfLine(line, maxLength = 82) {
  const text = safeString(line);
  if (text.length <= maxLength) return [text];

  const words = text.split(/\s+/);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    if (!word) return;
    if (!current) {
      current = word;
      return;
    }
    if (`${current} ${word}`.length <= maxLength) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  });

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function buildPdfContentStream(lines) {
  const escapedLines = lines.reduce(
    (wrappedLines, line) => wrappedLines.concat(wrapPdfLine(line)),
    [],
  );
  const commands = ["BT", "/F1 12 Tf", "72 760 Td", "14 TL"];

  escapedLines.slice(0, 48).forEach((line, index) => {
    if (index > 0) commands.push("T*");
    commands.push(`(${sanitizePdfText(line)}) Tj`);
  });

  commands.push("ET");
  return commands.join("\n");
}

function createSimplePdf(lines) {
  const stream = buildPdfContentStream(lines);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
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

export function formatNotesAsPdf(notes) {
  const normalizedNotes = normalizeExportNotes(notes);

  if (normalizedNotes.length === 0) {
    return createSimplePdf(["No notes to export."]);
  }

  const lines = normalizedNotes.reduce((allLines, note, index) => {
    const noteLines = [
      index > 0 ? "" : "Keeper Note Export",
      index > 0 ? "---" : "",
      `Title: ${note.title || "Untitled"}`,
      `Category: ${note.category || "none"}`,
      `Date: ${formatDisplayDate(note.created_at || note.updated_at)}`,
      `Pinned: ${note.pinned ? "Yes" : "No"}`,
    ].filter(Boolean);

    if (note.voice_note) {
      noteLines.push(
        "Voice Note: Metadata only",
        `Voice Duration: ${note.voice_note.duration ?? "Not available"}`,
        `Voice Audio URL: ${note.voice_note.audio_url || "Not available"}`,
      );
    }

    noteLines.push("", "Content:", note.content || "");
    return allLines.concat(noteLines);
  }, []);

  return createSimplePdf(lines);
}

export function getNoteExportFilename(note, format) {
  const date = new Date().toISOString().slice(0, 10);
  const rawTitle = safeString(note?.title).trim() || "untitled-note";
  const slug =
    rawTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "untitled-note";

  return `keeper-note-${slug}-${date}.${format}`;
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
