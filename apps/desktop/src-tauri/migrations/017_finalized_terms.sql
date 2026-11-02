-- Terms whose grades the teacher has finalized in a class record: locked against
-- editing until unfinalized.
CREATE TABLE finalized_terms (
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  term INTEGER NOT NULL CHECK (term BETWEEN 1 AND 3),
  finalized_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (class_id, term)
);
