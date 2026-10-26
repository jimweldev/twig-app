-- Kindergarten (grade_level 0) to Grade 12. The old CHECK on sections allowed
-- only Grades 4-10, and SQLite can't change a CHECK in place.
--
-- Migrations run in a transaction with foreign keys ON, so a plain rebuild of
-- sections would cascade-delete everything under it. Instead every table that
-- hangs off sections is rebuilt as *_new (referencing the other *_new tables),
-- the data copied, the old tables dropped leaves-first (so no DROP has
-- children left to cascade into), then the *_new tables renamed. With foreign
-- keys ON, each rename also rewrites the references in the other tables.

CREATE TABLE sections_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_year_id INTEGER NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
  grade_level INTEGER NOT NULL CHECK (grade_level BETWEEN 0 AND 12),
  name TEXT NOT NULL,
  adviser TEXT NOT NULL DEFAULT '',
  is_advisory INTEGER NOT NULL DEFAULT 0,
  UNIQUE (school_year_id, grade_level, name)
);
INSERT INTO sections_new (id, school_year_id, grade_level, name, adviser, is_advisory)
  SELECT id, school_year_id, grade_level, name, adviser, is_advisory FROM sections;

-- subject_type picks Senior High weights; terms lists the terms a subject
-- runs (comma-separated), since SHS subjects may not span all three.
CREATE TABLE classes_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES sections_new(id) ON DELETE CASCADE,
  learning_area TEXT NOT NULL,
  subject_type TEXT NOT NULL DEFAULT '',
  terms TEXT NOT NULL DEFAULT '1,2,3',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO classes_new (id, section_id, learning_area, created_at)
  SELECT id, section_id, learning_area, created_at FROM classes WHERE section_id IS NOT NULL;

CREATE TABLE learners_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES sections_new(id) ON DELETE CASCADE,
  lrn TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT NOT NULL DEFAULT '',
  sex TEXT NOT NULL CHECK (sex IN ('M', 'F')),
  birthdate TEXT NOT NULL DEFAULT ''
);
INSERT INTO learners_new (id, section_id, lrn, last_name, first_name, middle_name, sex, birthdate)
  SELECT id, section_id, lrn, last_name, first_name, middle_name, sex, birthdate FROM learners;

CREATE TABLE activities_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes_new(id) ON DELETE CASCADE,
  term INTEGER NOT NULL CHECK (term BETWEEN 1 AND 3),
  component TEXT NOT NULL CHECK (component IN ('WW', 'PT', 'ST1', 'ST2', 'TE')),
  position INTEGER NOT NULL,
  highest_score REAL NOT NULL DEFAULT 0
);
INSERT INTO activities_new (id, class_id, term, component, position, highest_score)
  SELECT id, class_id, term, component, position, highest_score FROM activities
  WHERE class_id IN (SELECT id FROM classes_new);

CREATE TABLE scores_new (
  activity_id INTEGER NOT NULL REFERENCES activities_new(id) ON DELETE CASCADE,
  learner_id INTEGER NOT NULL REFERENCES learners_new(id) ON DELETE CASCADE,
  score REAL NOT NULL,
  PRIMARY KEY (activity_id, learner_id)
);
INSERT INTO scores_new (activity_id, learner_id, score)
  SELECT activity_id, learner_id, score FROM scores
  WHERE activity_id IN (SELECT id FROM activities_new);

CREATE TABLE received_grades_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES sections_new(id) ON DELETE CASCADE,
  learning_area TEXT NOT NULL,
  teacher_name TEXT NOT NULL DEFAULT '',
  exported_at TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  checksum TEXT NOT NULL,
  UNIQUE (section_id, learning_area)
);
INSERT INTO received_grades_new (id, section_id, learning_area, teacher_name, exported_at, imported_at, checksum)
  SELECT id, section_id, learning_area, teacher_name, exported_at, imported_at, checksum FROM received_grades;

-- Term/final columns are untyped: numbers for numeric grading, codes such
-- as 'A' for descriptive grading (Grades 1-3).
CREATE TABLE received_grade_rows_new (
  received_id INTEGER NOT NULL REFERENCES received_grades_new(id) ON DELETE CASCADE,
  learner_id INTEGER NOT NULL REFERENCES learners_new(id) ON DELETE CASCADE,
  term1,
  term2,
  term3,
  final,
  PRIMARY KEY (received_id, learner_id)
);
INSERT INTO received_grade_rows_new (received_id, learner_id, term1, term2, term3, final)
  SELECT received_id, learner_id, term1, term2, term3, final FROM received_grade_rows;

CREATE TABLE section_subject_order_new (
  section_id INTEGER NOT NULL REFERENCES sections_new(id) ON DELETE CASCADE,
  learning_area TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (section_id, learning_area)
);
INSERT INTO section_subject_order_new (section_id, learning_area, position)
  SELECT section_id, learning_area, position FROM section_subject_order;

CREATE TABLE attendance_no_class_new (
  section_id INTEGER NOT NULL REFERENCES sections_new(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  PRIMARY KEY (section_id, date)
);
INSERT INTO attendance_no_class_new (section_id, date) SELECT section_id, date FROM attendance_no_class;

CREATE TABLE attendance_marks_new (
  learner_id INTEGER NOT NULL REFERENCES learners_new(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('A', 'L')),
  PRIMARY KEY (learner_id, date)
);
INSERT INTO attendance_marks_new (learner_id, date, status) SELECT learner_id, date, status FROM attendance_marks;

CREATE TABLE observed_values_new (
  learner_id INTEGER NOT NULL REFERENCES learners_new(id) ON DELETE CASCADE,
  term INTEGER NOT NULL CHECK (term BETWEEN 1 AND 3),
  behavior TEXT NOT NULL,
  marking TEXT NOT NULL CHECK (marking IN ('AO', 'SO', 'RO', 'NO')),
  PRIMARY KEY (learner_id, term, behavior)
);
INSERT INTO observed_values_new (learner_id, term, behavior, marking)
  SELECT learner_id, term, behavior, marking FROM observed_values;

-- Drop the old tables leaves-first.
DROP TABLE scores;
DROP TABLE received_grade_rows;
DROP TABLE attendance_marks;
DROP TABLE observed_values;
DROP TABLE activities;
DROP TABLE received_grades;
DROP TABLE section_subject_order;
DROP TABLE attendance_no_class;
DROP TABLE classes;
DROP TABLE learners;
DROP TABLE sections;

ALTER TABLE sections_new RENAME TO sections;
ALTER TABLE classes_new RENAME TO classes;
ALTER TABLE learners_new RENAME TO learners;
ALTER TABLE activities_new RENAME TO activities;
ALTER TABLE scores_new RENAME TO scores;
ALTER TABLE received_grades_new RENAME TO received_grades;
ALTER TABLE received_grade_rows_new RENAME TO received_grade_rows;
ALTER TABLE section_subject_order_new RENAME TO section_subject_order;
ALTER TABLE attendance_no_class_new RENAME TO attendance_no_class;
ALTER TABLE attendance_marks_new RENAME TO attendance_marks;
ALTER TABLE observed_values_new RENAME TO observed_values;

CREATE INDEX idx_classes_section ON classes(section_id);
CREATE INDEX idx_learners_section ON learners(section_id);
CREATE INDEX idx_activities_class ON activities(class_id, term);

-- Descriptive grades: Grades 1-3 (A-E per term; term 4 = final) and
-- Kindergarten (CO/DV/BG per developmental domain; item = domain key).
CREATE TABLE descriptive_ratings (
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  term INTEGER NOT NULL CHECK (term BETWEEN 1 AND 4),
  item TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  PRIMARY KEY (class_id, learner_id, term, item)
);
