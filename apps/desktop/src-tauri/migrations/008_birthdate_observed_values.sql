-- Birthdate prints the learner's age on the report card (SF9).
ALTER TABLE learners ADD COLUMN birthdate TEXT NOT NULL DEFAULT ''; -- YYYY-MM-DD or ''

-- Report on Learner's Observed Values (SF9): one marking per core-value
-- behavior statement per term. behavior is a key such as 'maka-diyos-1'.
CREATE TABLE observed_values (
  learner_id INTEGER NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  term INTEGER NOT NULL CHECK (term BETWEEN 1 AND 3),
  behavior TEXT NOT NULL,
  marking TEXT NOT NULL CHECK (marking IN ('AO', 'SO', 'RO', 'NO')),
  PRIMARY KEY (learner_id, term, behavior)
);
