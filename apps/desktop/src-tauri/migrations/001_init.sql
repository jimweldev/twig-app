CREATE TABLE school_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  region TEXT NOT NULL DEFAULT '',
  division TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  school_name TEXT NOT NULL DEFAULT '',
  school_id TEXT NOT NULL DEFAULT '',
  teacher_name TEXT NOT NULL DEFAULT ''
);
INSERT INTO school_profile (id) VALUES (1);

CREATE TABLE classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_year TEXT NOT NULL,
  grade_level INTEGER NOT NULL CHECK (grade_level BETWEEN 4 AND 10),
  section TEXT NOT NULL,
  learning_area TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE learners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  lrn TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT NOT NULL DEFAULT '',
  sex TEXT NOT NULL CHECK (sex IN ('M', 'F'))
);
CREATE INDEX idx_learners_class ON learners(class_id);

-- component: WW (written works), PT (performance tasks),
-- ST1 / ST2 (summative tests), TE (term exam)
CREATE TABLE activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  term INTEGER NOT NULL CHECK (term BETWEEN 1 AND 3),
  component TEXT NOT NULL CHECK (component IN ('WW', 'PT', 'ST1', 'ST2', 'TE')),
  position INTEGER NOT NULL,
  highest_score REAL NOT NULL DEFAULT 0
);
CREATE INDEX idx_activities_class ON activities(class_id, term);

CREATE TABLE scores (
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  score REAL NOT NULL,
  PRIMARY KEY (activity_id, learner_id)
);
