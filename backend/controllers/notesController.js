const pool = require("../db");

// ✅ GET all notes for logged in user
async function getNotes(req, res) {
  try {
    const result = await pool.query(
      `SELECT
         n.*,
         CASE
           WHEN vn.id IS NULL THEN NULL
           ELSE json_build_object(
             'id', vn.id,
             'audio_url', vn.audio_url,
             'duration', vn.duration,
             'file_size', vn.file_size,
             'mime_type', vn.mime_type,
             'storage_provider', vn.storage_provider,
             'storage_key', vn.storage_key,
             'created_at', vn.created_at,
             'updated_at', vn.updated_at
           )
         END AS voice_note
       FROM notes n
       LEFT JOIN voice_notes vn
         ON vn.note_id = n.id AND vn.user_id = n.user_id
       WHERE n.user_id = $1
       ORDER BY n.is_pinned DESC, n.position ASC, n.created_at DESC`,
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
  const { title, content, color, is_pinned, position, category } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO notes (user_id, title, content, color, is_pinned, position, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.user.id,
        title || "",
        content || "",
        color || "#ffffff",
        is_pinned || false,
        position || 0,
        category || "none",
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
  const { title, content, category } = req.body;
  try {
    const result = await pool.query(
      `UPDATE notes 
       SET title=$1, content=$2, category=$3, updated_at=NOW()
       WHERE id=$4 AND user_id=$5 
       RETURNING *`,
      [title, content, category || "none", id, req.user.id]
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

// ✅ UPDATE note positions after drag
async function updateNotePositions(req, res) {
  const { orderedIds } = req.body;

  if (!orderedIds || !Array.isArray(orderedIds)) {
    return res.status(400).json({ error: "orderedIds array required." });
  }

  try {
    // Update each note's position
    const updates = orderedIds.map((id, index) =>
      pool.query(
        "UPDATE notes SET position = $1 WHERE id = $2 AND user_id = $3",
        [index, id, req.user.id]
      )
    );

    await Promise.all(updates);
    res.json({ message: "Positions updated." });
  } catch (err) {
    console.error("Update positions error:", err.message);
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

async function updateNoteCategory(req, res) {
  const { id } = req.params;
  const { category } = req.body;
  try {
    const result = await pool.query(
      `UPDATE notes SET category=$1, updated_at=NOW()
       WHERE id=$2 AND user_id=$3 RETURNING *`,
      [category || "none", id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update category error:", err.message);
    res.status(500).json({ error: "Server error." });
  }
}

async function importNotes(req, res) {
  const { notes } = req.body;

  if (!Array.isArray(notes)) {
    return res.status(400).json({ error: "Notes array is required." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertedRows = [];

    for (let i = 0; i < notes.length; i += 1) {
      const note = notes[i];
      const result = await client.query(
        `INSERT INTO notes (user_id, title, content, color, is_pinned, position, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          req.user.id,
          note.title || "",
          note.content || "",
          note.color || "#ffffff",
          note.is_pinned || false,
          typeof note.position === "number" ? note.position : i,
          note.category || "none",
        ]
      );
      insertedRows.push(result.rows[0]);
    }

    await client.query("COMMIT");
    res.status(201).json({ message: "Guest notes imported successfully.", notes: insertedRows });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Import notes error:", err.message);
    res.status(500).json({ error: "Failed to import notes." });
  } finally {
    client.release();
  }
}

module.exports = {
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  updateNoteColor,
  togglePin,
  updateNotePositions,
  updateNoteCategory,
  importNotes,
};
