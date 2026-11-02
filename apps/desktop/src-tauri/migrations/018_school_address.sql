-- The school's address, printed under its name on lesson plans, e.g. "Citicenter, Pandan, Angeles City".
ALTER TABLE school_profile ADD COLUMN address TEXT NOT NULL DEFAULT '';
