const path = require("path");
const fs = require("fs");
const multer = require("multer");
const pool = require("../db");

const uploadsDir = path.join(__dirname, "..", "uploads", "attachments");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB per file
const MAX_ATTACHMENTS_PER_NOTE = 10;

// Mime types we accept. Checked alongside the extension below — never
// trust the client-reported mimetype (or the extension) alone.
const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
  // PDF
  "application/pdf",
  // Word
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // Excel
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // PowerPoint
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Text
  "text/plain",
  // Zip
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  // Audio
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  // Video
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg",
  ".pdf",
  ".doc", ".docx",
  ".xls", ".xlsx",
  ".ppt", ".pptx",
  ".txt",
  ".zip",
  ".mp3", ".wav", ".ogg", ".webm", ".m4a",
  ".mp4", ".mov", ".avi", ".mkv",
]);

function sanitizeFilename(originalName) {
  return originalName
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-.]/g, "");
}

function createAttachmentStorage() {
  return multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const safeName = sanitizeFilename(file.originalname);
      cb(
        null,
        `${timestamp}-${Math.random().toString(36).slice(2)}-${safeName}`
      );
    },
  });
}

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`Unsupported file type: ${file.originalname}`));
  }

  cb(null, true);
}

const uploadAttachments = multer({
  storage: createAttachmentStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_ATTACHMENTS_PER_NOTE,
  },
  fileFilter,
});

function getFileUrl(filename) {
  return `/uploads/attachments/${filename}`;
}

async function deleteLocalFile(storedName) {
  if (!storedName) return;

  const filePath = path.join(uploadsDir, path.basename(storedName));

  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("Delete local attachment file error:", err.message);
    }
  }
}

async function cleanupUploadedFiles(files) {
  if (!files || files.length === 0) return;
  await Promise.all(files.map((file) => deleteLocalFile(file.filename)));
}

// ────────────────────────────────────────────────────────────────────────
// UPLOAD one or more attachments onto an existing note
// ────────────────────────────────────────────────────────────────────────
async function uploadAttachmentFiles(req, res) {
  const { noteId } = req.params;
  const files = req.files || [];

  if (!noteId) {
    await cleanupUploadedFiles(files);
    return res.status(400).json({ error: "Note ID is required." });
  }

  if (files.length === 0) {
    return res.status(400).json({ error: "At least one file is required." });
  }

  const client = await pool.connect();

  try {
    const noteResult = await client.query(
      "SELECT id FROM notes WHERE id = $1 AND user_id = $2",
      [noteId, req.user.id]
    );

    if (noteResult.rows.length === 0) {
      await cleanupUploadedFiles(files);
      return res.status(404).json({ error: "Note not found." });
    }

    const countResult = await client.query(
      "SELECT COUNT(*)::int AS count FROM attachments WHERE note_id = $1",
      [noteId]
    );
    const existingCount = countResult.rows[0].count;

    if (existingCount + files.length > MAX_ATTACHMENTS_PER_NOTE) {
      await cleanupUploadedFiles(files);
      const remaining = Math.max(MAX_ATTACHMENTS_PER_NOTE - existingCount, 0);
      return res.status(400).json({
        error:
          remaining > 0
            ? `This note already has ${existingCount} attachment(s). You can add up to ${remaining} more (max ${MAX_ATTACHMENTS_PER_NOTE} per note).`
            : `This note has reached the maximum of ${MAX_ATTACHMENTS_PER_NOTE} attachments.`,
      });
    }

    await client.query("BEGIN");

    const insertedAttachments = [];
    for (const file of files) {
      const result = await client.query(
        `INSERT INTO attachments (
           note_id, user_id, original_name, stored_name, mime_type, file_size, file_path
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          noteId,
          req.user.id,
          file.originalname.slice(0, 255),
          file.filename,
          file.mimetype,
          file.size,
          getFileUrl(file.filename),
        ]
      );
      insertedAttachments.push(result.rows[0]);
    }

    await client.query("COMMIT");

    res.status(201).json({ attachments: insertedAttachments });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Upload attachments error:", err.message);
    await cleanupUploadedFiles(files);
    res.status(500).json({ error: "Failed to upload attachments." });
  } finally {
    client.release();
  }
}

// ────────────────────────────────────────────────────────────────────────
// GET all attachments for a note
// ────────────────────────────────────────────────────────────────────────
async function getAttachments(req, res) {
  const { noteId } = req.params;

  try {
    const noteResult = await pool.query(
      "SELECT id FROM notes WHERE id = $1 AND user_id = $2",
      [noteId, req.user.id]
    );

    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: "Note not found." });
    }

    const result = await pool.query(
      "SELECT * FROM attachments WHERE note_id = $1 AND user_id = $2 ORDER BY created_at ASC",
      [noteId, req.user.id]
    );

    res.json({ attachments: result.rows });
  } catch (err) {
    console.error("Get attachments error:", err.message);
    res.status(500).json({ error: "Failed to load attachments." });
  }
}

// ────────────────────────────────────────────────────────────────────────
// DELETE a single attachment (DB row + physical file)
// ────────────────────────────────────────────────────────────────────────
async function deleteAttachment(req, res) {
  const { attachmentId } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM attachments WHERE id = $1 AND user_id = $2",
      [attachmentId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Attachment not found." });
    }

    const attachment = result.rows[0];

    await pool.query("DELETE FROM attachments WHERE id = $1 AND user_id = $2", [
      attachmentId,
      req.user.id,
    ]);

    await deleteLocalFile(attachment.stored_name);

    res.json({ message: "Attachment deleted successfully." });
  } catch (err) {
    console.error("Delete attachment error:", err.message);
    res.status(500).json({ error: "Failed to delete attachment." });
  }
}

// ────────────────────────────────────────────────────────────────────────
// DOWNLOAD a single attachment with its original filename
// ────────────────────────────────────────────────────────────────────────
async function downloadAttachment(req, res) {
  const { attachmentId } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM attachments WHERE id = $1 AND user_id = $2",
      [attachmentId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Attachment not found." });
    }

    const attachment = result.rows[0];
    const filePath = path.join(uploadsDir, path.basename(attachment.stored_name));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File no longer exists on the server." });
    }

    res.download(filePath, attachment.original_name, (err) => {
      if (err) {
        console.error("Download stream error:", err.message);
      }
    });
  } catch (err) {
    console.error("Download attachment error:", err.message);
    res.status(500).json({ error: "Failed to download attachment." });
  }
}

module.exports = {
  uploadAttachments,
  uploadAttachmentFiles,
  getAttachments,
  deleteAttachment,
  downloadAttachment,
  deleteLocalFile,
};