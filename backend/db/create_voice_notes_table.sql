-- Create voice_notes table for storing audio metadata.
-- Duration is stored in milliseconds.
CREATE TABLE IF NOT EXISTS voice_notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0,
  file_size BIGINT,
  mime_type VARCHAR(50),
  storage_provider VARCHAR(30) NOT NULL DEFAULT 'local',
  storage_key TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT voice_notes_one_per_note UNIQUE (note_id)
);

-- Indexes for fast lookups and ownership checks.
CREATE INDEX IF NOT EXISTS idx_voice_notes_note_id ON voice_notes(note_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_user_id ON voice_notes(user_id);
