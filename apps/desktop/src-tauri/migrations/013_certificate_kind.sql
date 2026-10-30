-- What a certificate template is for. The type sets sensible fields and who gets
-- one; the teacher can still change both.
ALTER TABLE certificate_templates ADD COLUMN kind TEXT NOT NULL DEFAULT 'custom'
  CHECK (kind IN ('honors', 'award', 'recognition', 'custom'));

-- Templates made before types: read the type off the fields they already have.
UPDATE certificate_templates SET kind = 'honors' WHERE fields LIKE '%"key":"honor"%';
UPDATE certificate_templates SET kind = 'award' WHERE kind = 'custom' AND fields LIKE '%"key":"award"%';
