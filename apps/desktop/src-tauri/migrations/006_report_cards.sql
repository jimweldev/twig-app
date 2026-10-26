-- Order of learning areas on a section's report card (SF9) and consolidated grades.
CREATE TABLE section_subject_order (
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  learning_area TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (section_id, learning_area)
);

-- Signs report cards with the adviser.
ALTER TABLE school_profile ADD COLUMN school_head TEXT NOT NULL DEFAULT '';
