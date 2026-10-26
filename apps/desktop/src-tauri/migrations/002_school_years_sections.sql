CREATE TABLE school_years (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE, -- e.g. 2026-2027
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_year_id INTEGER NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
  grade_level INTEGER NOT NULL CHECK (grade_level BETWEEN 4 AND 10),
  name TEXT NOT NULL,
  adviser TEXT NOT NULL DEFAULT '',
  UNIQUE (school_year_id, grade_level, name)
);

-- Move existing classes onto school years and sections.
INSERT INTO school_years (name) SELECT DISTINCT school_year FROM classes;
UPDATE school_years SET is_active = 1
  WHERE id = (SELECT id FROM school_years ORDER BY name DESC LIMIT 1);

INSERT INTO sections (school_year_id, grade_level, name)
  SELECT DISTINCT sy.id, c.grade_level, c.section
  FROM classes c JOIN school_years sy ON sy.name = c.school_year;

-- Columns are added and dropped in place: rebuilding the table would
-- cascade-delete learners and activities, since foreign keys are on.
ALTER TABLE classes ADD COLUMN section_id INTEGER REFERENCES sections(id);
UPDATE classes SET section_id = (
  SELECT s.id FROM sections s JOIN school_years sy ON sy.id = s.school_year_id
  WHERE sy.name = classes.school_year
    AND s.grade_level = classes.grade_level
    AND s.name = classes.section
);
ALTER TABLE classes DROP COLUMN school_year;
ALTER TABLE classes DROP COLUMN grade_level;
ALTER TABLE classes DROP COLUMN section;
CREATE INDEX idx_classes_section ON classes(section_id);
