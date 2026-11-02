-- Images printed in the footer of every lesson plan page, e.g. school and DepEd logos.
-- JSON: {"left": ["data:image/png;base64,..."], "right": [...]}.
ALTER TABLE school_profile ADD COLUMN lesson_footer TEXT NOT NULL DEFAULT '{"left":[],"right":[]}';
