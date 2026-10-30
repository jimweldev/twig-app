-- Certificate templates: the teacher's finished design as an image, with the
-- per-learner values (the name) placed on top. Not tied to a school year so a
-- template can be reused every year.
CREATE TABLE certificate_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  image TEXT NOT NULL,           -- data: URL of the uploaded design
  width INTEGER NOT NULL,        -- image size in pixels; sets the page shape
  height INTEGER NOT NULL,
  fields TEXT NOT NULL DEFAULT '[]', -- JSON CertField[] (see src/certificates/fields.ts)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
