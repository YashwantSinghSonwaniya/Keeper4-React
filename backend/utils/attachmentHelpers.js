// Framework-agnostic helpers for classifying and formatting attachments.
// Map `getAttachmentKind`'s return value to whichever icon you use per kind.

const KIND_BY_MIME = [
  { test: (m) => m.startsWith("image/"), kind: "image" },
  { test: (m) => m === "application/pdf", kind: "pdf" },
  {
    test: (m) =>
      m === "application/msword" ||
      m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    kind: "document",
  },
  {
    test: (m) =>
      m === "application/vnd.ms-excel" ||
      m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    kind: "spreadsheet",
  },
  {
    test: (m) =>
      m === "application/vnd.ms-powerpoint" ||
      m === "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    kind: "presentation",
  },
  { test: (m) => m === "text/plain", kind: "text" },
  {
    test: (m) =>
      m === "application/zip" || m === "application/x-zip-compressed" || m === "application/x-zip",
    kind: "archive",
  },
  { test: (m) => m.startsWith("audio/"), kind: "audio" },
  { test: (m) => m.startsWith("video/"), kind: "video" },
];

export function getAttachmentKind(mimeType = "") {
  const match = KIND_BY_MIME.find(({ test }) => test(mimeType));
  return match ? match.kind : "file";
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}