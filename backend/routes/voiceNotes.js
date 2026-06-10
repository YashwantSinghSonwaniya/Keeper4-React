const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const {
  uploadVoice,
  uploadVoiceNote,
  getVoiceNote,
  deleteVoiceNote,
} = require("../controllers/voiceNotesController");

// All voice routes are protected
router.use(authenticateToken);

function handleAudioUpload(req, res, next) {
  uploadVoice.single("audio")(req, res, (err) => {
    if (!err) return next();

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Voice note must be 25MB or smaller." });
    }

    return res.status(400).json({ error: err.message || "Audio upload failed." });
  });
}

router.post("/:noteId", handleAudioUpload, uploadVoiceNote);
router.get("/:noteId", getVoiceNote);
router.delete("/:voiceId", deleteVoiceNote);

module.exports = router;
