-- Learners belong to a section, shared by all its class records.
--
-- Migrations run in a transaction with foreign keys on, so tables are
-- rebuilt in an order where no DROP cascades into rows we keep:
-- new learners -> new scores -> drop old scores -> drop old learners -> rename.

-- A learner listed in several classes of one section becomes one learner
-- (lowest id wins); their scores follow.
CREATE TABLE learner_map AS
  SELECT l.id AS old_id,
    (SELECT MIN(l2.id) FROM learners l2 JOIN classes c2 ON c2.id = l2.class_id
     WHERE c2.section_id = c.section_id
       AND lower(trim(l2.last_name)) = lower(trim(l.last_name))
       AND lower(trim(l2.first_name)) = lower(trim(l.first_name))
       AND lower(trim(l2.middle_name)) = lower(trim(l.middle_name))) AS new_id
  FROM learners l JOIN classes c ON c.id = l.class_id
  WHERE c.section_id IS NOT NULL;

CREATE TABLE learners_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  lrn TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT NOT NULL DEFAULT '',
  sex TEXT NOT NULL CHECK (sex IN ('M', 'F'))
);
INSERT INTO learners_new (id, section_id, lrn, last_name, first_name, middle_name, sex)
  SELECT l.id, c.section_id, l.lrn, l.last_name, l.first_name, l.middle_name, l.sex
  FROM learners l JOIN classes c ON c.id = l.class_id
  WHERE l.id IN (SELECT new_id FROM learner_map);

CREATE TABLE scores_new (
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  learner_id INTEGER NOT NULL REFERENCES learners_new(id) ON DELETE CASCADE,
  score REAL NOT NULL,
  PRIMARY KEY (activity_id, learner_id)
);
INSERT OR IGNORE INTO scores_new (activity_id, learner_id, score)
  SELECT s.activity_id, m.new_id, s.score
  FROM scores s JOIN learner_map m ON m.old_id = s.learner_id;

DROP TABLE scores;
DROP TABLE learner_map;
DROP INDEX idx_learners_class;
DROP TABLE learners;
ALTER TABLE learners_new RENAME TO learners;
ALTER TABLE scores_new RENAME TO scores;
CREATE INDEX idx_learners_section ON learners(section_id);
