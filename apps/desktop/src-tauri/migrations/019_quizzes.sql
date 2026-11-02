-- Quizzes and tests, often generated from a lesson plan. Like lesson plans they are not
-- tied to a school year. The parts and items live in `content` as JSON (see QuizContent
-- in src/quizzes/quiz.ts).
CREATE TABLE quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  lesson_plan_id INTEGER REFERENCES lesson_plans(id) ON DELETE SET NULL,
  grade_level INTEGER NOT NULL CHECK (grade_level BETWEEN 0 AND 12),
  learning_area TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
