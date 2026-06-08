const pool = require("../db");

// ✅ GET all notes for logged in user
async function getNotes(req, res) {
  try {
    const result = await pool.query(
      "SELECT * FROM notes WHERE user_id = $1 ORDER BY is_pinned DESC, position ASC, created_at DESC",
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Get notes error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
}

// ✅ CREATE note
async function createNote(req, res) {
  const { title, content, color, is_pinned, position } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO notes (user_id, title, content, color, is_pinned, position)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.user.id,
        title || "",
        content || "",
        color || "#ffffff",
        is_pinned || false,
        position || 0,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create note error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
}

// ✅ UPDATE note (title + content)
async function updateNote(req, res) {
  const { id } = req.params;
  const { title, content } = req.body;
  try {
    const result = await pool.query(
      `UPDATE notes SET title=$1, content=$2, updated_at=NOW()
       WHERE id=$3 AND user_id=$4 RETURNING *`,
      [title, content, id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Note not found." });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update note error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
}

// ✅ DELETE note
async function deleteNote(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM notes WHERE id=$1 AND user_id=$2 RETURNING *",
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Note not found." });
    }
    res.json({ message: "Note deleted successfully." });
  } catch (err) {
    console.error("Delete note error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
}

// ✅ UPDATE note color
async function updateNoteColor(req, res) {
  const { id } = req.params;
  const { color } = req.body;
  try {
    const result = await pool.query(
      "UPDATE notes SET color=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3 RETURNING *",
      [color, id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update color error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
}

// ✅ TOGGLE pin
async function togglePin(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE notes SET is_pinned = NOT is_pinned, updated_at=NOW()
       WHERE id=$1 AND user_id=$2 RETURNING *`,
      [id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Toggle pin error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
}

module.exports = {
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  updateNoteColor,
  togglePin,
};