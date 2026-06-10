const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const {
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  updateNoteColor,
  togglePin,
  updateNotePositions,
} = require("../controllers/notesController");

// All notes routes are protected
router.use(authenticateToken);

router.get("/", getNotes);
router.post("/", createNote);
router.put("/:id", updateNote);
router.delete("/:id", deleteNote);
router.patch("/:id/color", updateNoteColor);
router.patch("/:id/pin", togglePin);
router.patch("/reorder", updateNotePositions);

module.exports = router;