-- Positions and the lesson plan checker, filled in on new lesson plans and printed under signatures.
ALTER TABLE school_profile ADD COLUMN teacher_position TEXT NOT NULL DEFAULT '';
ALTER TABLE school_profile ADD COLUMN school_head_position TEXT NOT NULL DEFAULT '';
ALTER TABLE school_profile ADD COLUMN checker_name TEXT NOT NULL DEFAULT '';
ALTER TABLE school_profile ADD COLUMN checker_position TEXT NOT NULL DEFAULT '';
