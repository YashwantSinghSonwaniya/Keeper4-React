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


function escapePdfText(value) {
  return safeString(value)
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapPdfLine(line, maxLength = 82) {
  const text = safeString(line);
  if (text.length <= maxLength) return [text];

  const words = text.split(/\s+/);
  const lines = [];
  let current = "";

  words.forEach((word) => {
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
  return lines.length > 0 ? lines : [text];
}

function buildPdfLines(notes) {
  return formatNotesAsTxt(notes)
    .split("\n")
    .flatMap((line) => wrapPdfLine(line));
}

function buildPdfDocument(lines) {
  const linesPerPage = 48;
  const pages = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages
      .map((_, index) => `${3 + index * 2} 0 R`)
      .join(" ")}] /Count ${pages.length} >>`,
  ];

  pages.forEach((pageLines, index) => {
    const pageObjectNumber = 3 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    const stream = [
      "BT",
      "/F1 11 Tf",
      "50 780 Td",
      "14 TL",
      ...pageLines.map((line) => `(${escapePdfText(line)}) Tj T*`),
      "ET",
    ].join("\n");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

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

export function formatNotesAsPdf(notes) {
  const lines = buildPdfLines(notes);
  return new Blob([buildPdfDocument(lines)], { type: "application/pdf" });
}

export function downloadBlobFile({ blob, filename }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
