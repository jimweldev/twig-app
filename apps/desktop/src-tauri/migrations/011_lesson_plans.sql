-- ILAW lesson plans (DepEd Order No. 16, s. 2026). Not tied to a school year so
-- a plan can be reused. The written parts live in `content` as JSON
-- (see PlanContent in src/lessons/plan.ts).
CREATE TABLE lesson_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  grade_level INTEGER NOT NULL CHECK (grade_level BETWEEN 0 AND 12),
  learning_area TEXT NOT NULL DEFAULT '',
  sections TEXT NOT NULL DEFAULT '',
  term INTEGER NOT NULL DEFAULT 1 CHECK (term BETWEEN 1 AND 3),
  week INTEGER NOT NULL DEFAULT 1,
  sessions INTEGER NOT NULL DEFAULT 1,
  minutes INTEGER NOT NULL DEFAULT 60,
  content TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
