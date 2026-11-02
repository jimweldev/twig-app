-- MAPEH (Grades 4-10) is scored as two parts, Music and Arts (MA) and
-- PE and Health (PEH); its term grade is the average of theirs.
-- '' for every other learning area.
ALTER TABLE activities ADD COLUMN part TEXT NOT NULL DEFAULT '';

-- Existing MAPEH columns become Music and Arts; PE and Health gets its own exam slots.
UPDATE activities SET part = 'MA' WHERE class_id IN (SELECT id FROM classes WHERE learning_area = 'MAPEH');
INSERT INTO activities (class_id, term, component, position, highest_score, part)
SELECT class_id, term, component, 1, 0, 'PEH' FROM activities
WHERE part = 'MA' AND component IN ('ST1', 'ST2', 'TE');
