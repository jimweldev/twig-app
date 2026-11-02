-- A subject's own grading weights, as JSON like {"WW":0.25,"PT":0.45,"EX":0.3,"exam":"split"};
-- blank uses the DepEd weights for its grade and learning area.
ALTER TABLE classes ADD COLUMN weights TEXT NOT NULL DEFAULT '';
