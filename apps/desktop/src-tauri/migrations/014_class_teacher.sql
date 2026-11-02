-- Who teaches a subject: blank for the teacher using TWIG, else another teacher's
-- name (e.g. an adviser keeping records for subjects others teach).
ALTER TABLE classes ADD COLUMN teacher TEXT NOT NULL DEFAULT '';
