-- Grades a subject teacher sent to this section's adviser as a .twig file.
-- One row per section and learning area; a newer file replaces it.
CREATE TABLE received_grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  learning_area TEXT NOT NULL,
  teacher_name TEXT NOT NULL DEFAULT '',
  exported_at TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  checksum TEXT NOT NULL,
  UNIQUE (section_id, learning_area)
);

CREATE TABLE received_grade_rows (
  received_id INTEGER NOT NULL REFERENCES received_grades(id) ON DELETE CASCADE,
  learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  term1 INTEGER,
  term2 INTEGER,
  term3 INTEGER,
  final INTEGER,
  PRIMARY KEY (received_id, learner_id)
);
