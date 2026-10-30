-- Who a certificate template is for: every learner, only learners with honors
-- (general average of 90 and up), or learners the teacher picks by hand.
ALTER TABLE certificate_templates ADD COLUMN recipients TEXT NOT NULL DEFAULT 'all'
  CHECK (recipients IN ('all', 'honors', 'pick'));

-- Templates made before this setting printed honor certificates for honor learners only.
UPDATE certificate_templates SET recipients = 'honors' WHERE fields LIKE '%"key":"honor"%';
