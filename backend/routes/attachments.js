const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const {
  uploadAttachments,
  uploadAttachmentFiles,
  getAttachments,
  deleteAttachment,
  downloadAttachment,
} = require("../controllers/attachmentsController");

// All attachment routes are protected — guests never reach these because
// guests never hold a valid JWT in this app.
router.use(authenticateToken);

function handleAttachmentUpload(req, res, next) {
  uploadAttachments.array("files", 10)(req, res, (err) => {
    if (!err) return next();

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Each file must be 20MB or smaller." });
    }

    if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ error: "You can attach up to 10 files per note." });
    }

    return res.status(400).json({ error: err.message || "File upload failed." });
  });
}

router.post("/:noteId", handleAttachmentUpload, uploadAttachmentFiles);
router.get("/:noteId", getAttachments);
router.delete("/:attachmentId", deleteAttachment);
router.get("/:attachmentId/download", downloadAttachment);

module.exports = router;