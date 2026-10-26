-- The section the teacher advises. At most one per school year;
-- enforced by the app when a section is marked advisory.
ALTER TABLE sections ADD COLUMN is_advisory INTEGER NOT NULL DEFAULT 0;
