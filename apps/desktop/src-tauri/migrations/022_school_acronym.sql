-- The school's short name, e.g. "FGNMHS"; optional.
ALTER TABLE school_profile ADD COLUMN school_acronym TEXT NOT NULL DEFAULT '';
