const pool = require("../db");
const { deleteLocalFile } = require("./attachmentsController");

const voiceNoteJsonSql = `
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
`;

// Aggregates every row in `attachments` for a note into a single JSON array
// via a correlated LATERAL subquery. Using LATERAL (instead of a plain LEFT
// JOIN + GROUP BY) means we don't have to touch the existing voice_note
// LEFT JOIN or add a GROUP BY to any query that already selects n.*.
const attachmentsJsonSql = `COALESCE(att.attachments, '[]'::json) AS attachments`;

const attachmentsJoinSql = `
  LEFT JOIN LATERAL (
    SELECT json_agg(
             json_build_object(
               'id', a.id,
               'original_name', a.original_name,
               'mime_type', a.mime_type,
               'file_size', a.file_size,
               'file_path', a.file_path,
               'created_at', a.created_at
             )
             ORDER BY a.created_at ASC
           ) AS attachments
    FROM attachments a
    WHERE a.note_id = n.id AND a.user_id = n.user_id
  ) att ON true
`;

function updatedNoteWithVoiceNoteQuery(updateSql) {
  return `
    WITH updated_note AS (
      ${updateSql}
      RETURNING *
    )
    SELECT
      n.*,
      ${voiceNoteJsonSql},
      ${attachmentsJsonSql}
    FROM updated_note n
    LEFT JOIN voice_notes vn
      ON vn.note_id = n.id AND vn.user_id = n.user_id
    ${attachmentsJoinSql}
  `;
}

// ✅ GET all notes for logged in user
async function getNotes(req, res) {
  try {
    const result = await pool.query(
      `SELECT
         n.*,
         ${voiceNoteJsonSql},
         ${attachmentsJsonSql}
       FROM notes n
       LEFT JOIN voice_notes vn
         ON vn.note_id = n.id AND vn.user_id = n.user_id
       ${attachmentsJoinSql}
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
      updatedNoteWithVoiceNoteQuery(`
        UPDATE notes
        SET title=$1, content=$2, category=$3, updated_at=NOW()
        WHERE id=$4 AND user_id=$5
      `),
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

// ✅ DELETE note (also cleans up any attached files on disk)
async function deleteNote(req, res) {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const noteResult = await client.query(
      "SELECT id FROM notes WHERE id=$1 AND user_id=$2",
      [id, req.user.id]
    );

    if (noteResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Note not found." });
    }

    // Grab attachment filenames BEFORE the cascade delete removes their
    // rows, so we still know which physical files to remove afterward.
    const attachmentsResult = await client.query(
      "SELECT stored_name FROM attachments WHERE note_id=$1 AND user_id=$2",
      [id, req.user.id]
    );

    await client.query("DELETE FROM notes WHERE id=$1 AND user_id=$2", [
      id,
      req.user.id,
    ]);

    await client.query("COMMIT");

    // Best-effort filesystem cleanup, run after the transaction commits.
    await Promise.all(
      attachmentsResult.rows.map((row) => deleteLocalFile(row.stored_name))
    );

    res.json({ message: "Note deleted successfully." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Delete note error:", err.message);
    res.status(500).json({ error: "Server error." });
  } finally {
    client.release();
  }
}

// ✅ UPDATE note color
async function updateNoteColor(req, res) {
  const { id } = req.params;
  const { color } = req.body;
  try {
    const result = await pool.query(
      updatedNoteWithVoiceNoteQuery(`
        UPDATE notes
        SET color=$1, updated_at=NOW()
        WHERE id=$2 AND user_id=$3
      `),
      [color, id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Note not found." });
    }
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
      updatedNoteWithVoiceNoteQuery(`
        UPDATE notes
        SET is_pinned = NOT is_pinned, updated_at=NOW()
        WHERE id=$1 AND user_id=$2
      `),
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Note not found." });
    }
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
      updatedNoteWithVoiceNoteQuery(`
        UPDATE notes
        SET category=$1, updated_at=NOW()
        WHERE id=$2 AND user_id=$3
      `),
      [category || "none", id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Note not found." });
    }
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