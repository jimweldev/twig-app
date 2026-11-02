-- Groups made in Squad Up and saved, to look back on from the section.
-- groups is JSON: [{ "learnerIds": [1, 2], "leaderId": 1 }, ...] in group order.
CREATE TABLE saved_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  groups TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_saved_groups_section ON saved_groups(section_id);
