-- Daily attendance for a section (SF2-style). Every weekday inside the school
-- year is a school day unless listed as a no-class day; learners are present
-- unless marked absent (A) or late (L, which still counts as present).
CREATE TABLE attendance_no_class (
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- YYYY-MM-DD
  PRIMARY KEY (section_id, date)
);

CREATE TABLE attendance_marks (
  learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- YYYY-MM-DD
  status TEXT NOT NULL CHECK (status IN ('A', 'L')),
  PRIMARY KEY (learner_id, date)
);
