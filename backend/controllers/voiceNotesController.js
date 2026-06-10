const path = require("path");
const fs = require("fs");
const pool = require("../db");

const uploadsDir = path.join(__dirname, "..", "uploads", "voice");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function createVoiceStorage() {
  const multer = require("multer");

  return multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const safeName = file.originalname
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_\-.]/g, "");
      cb(
        null,
        `${timestamp}-${Math.random().toString(36).slice(2)}-${safeName}`
      );
    },
  });
}

const allowedAudioTypes = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
]);

const uploadVoice = require("multer")({
  storage: createVoiceStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (req, file, cb) => {
    if (allowedAudioTypes.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio type: ${file.mimetype}`));
    }
  },
});

function getAudioUrl(filename) {
  return `/uploads/voice/${filename}`;
}

async function deleteLocalFile(storageKey) {
  if (!storageKey) return;

  const filePath = path.join(uploadsDir, path.basename(storageKey));

  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("Delete local voice file error:", err.message);
    }
  }
}

async function cleanupUploadedFile(file) {
  if (!file?.filename) return;
  await deleteLocalFile(file.filename);
}

function parseDuration(rawDuration) {
  const duration = Number.parseInt(rawDuration, 10);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

async function uploadVoiceNote(req, res) {
  const { noteId } = req.params;

  if (!noteId) {
    await cleanupUploadedFile(req.file);
    return res.status(400).json({ error: "Note ID is required." });
  }

  if (!req.file) {
    return res.status(400).json({ error: "Audio file is required." });
  }

  if (req.file.size <= 0) {
    await cleanupUploadedFile(req.file);
    return res.status(400).json({ error: "Recording is empty." });
  }

  try {
    // Verify note exists and belongs to user
    const noteResult = await pool.query(
      "SELECT id FROM notes WHERE id = $1 AND user_id = $2",
      [noteId, req.user.id]
    );

    if (noteResult.rows.length === 0) {
      await cleanupUploadedFile(req.file);
      return res.status(404).json({ error: "Note not found." });
    }

    const existingVoice = await pool.query(
      "SELECT id FROM voice_notes WHERE note_id = $1 AND user_id = $2",
      [noteId, req.user.id]
    );

    if (existingVoice.rows.length > 0) {
      await cleanupUploadedFile(req.file);
      return res.status(409).json({ error: "This note already has a voice note." });
    }

    const duration = parseDuration(req.body.duration);
    const audioUrl = getAudioUrl(req.file.filename);

    // Save voice note metadata to database
    const result = await pool.query(
      `INSERT INTO voice_notes (
         user_id,
         note_id,
         audio_url,
         duration,
         file_size,
         mime_type,
         storage_provider,
         storage_key
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.user.id,
        noteId,
        audioUrl,
        duration,
        req.file.size,
        req.file.mimetype,
        "local",
        req.file.filename,
      ]
    );

    res.status(201).json({ voice_note: result.rows[0] });
  } catch (err) {
    console.error("Upload voice note error:", err.message);
    await cleanupUploadedFile(req.file);

    if (err.code === "23505") {
      return res.status(409).json({ error: "This note already has a voice note." });
    }

    res.status(500).json({ error: "Failed to upload voice note." });
  }
}

async function getVoiceNote(req, res) {
  const { noteId } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM voice_notes WHERE note_id = $1 AND user_id = $2",
      [noteId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json({ voice_note: null });
    }

    res.json({ voice_note: result.rows[0] });
  } catch (err) {
    console.error("Get voice note error:", err.message);
    res.status(500).json({ error: "Failed to load voice note." });
  }
}

async function deleteVoiceNote(req, res) {
  const { voiceId } = req.params;

  try {
    // Verify voice note belongs to user
    const voiceResult = await pool.query(
      "SELECT * FROM voice_notes WHERE id = $1 AND user_id = $2",
      [voiceId, req.user.id]
    );

    if (voiceResult.rows.length === 0) {
      return res.status(404).json({ error: "Voice note not found." });
    }

    const voiceNote = voiceResult.rows[0];

    // Delete from database
    await pool.query(
      "DELETE FROM voice_notes WHERE id = $1 AND user_id = $2",
      [voiceId, req.user.id]
    );

    if (voiceNote.storage_provider === "local") {
      await deleteLocalFile(voiceNote.storage_key);
    }

    res.json({ message: "Voice note deleted successfully." });
  } catch (err) {
    console.error("Delete voice note error:", err.message);
    res.status(500).json({ error: "Failed to delete voice note." });
  }
}

module.exports = {
  uploadVoice,
  uploadVoiceNote,
  getVoiceNote,
  deleteVoiceNote,
};
