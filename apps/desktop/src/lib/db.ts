import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import type { Component, Term } from "@/ecr/grading";

// Rust picks the database (twig-dev.db in development, twig.db in release
// builds) and runs its migrations; ask it which one so the two never drift.
let dbPromise: Promise<Database> | null = null;
const db = () => (dbPromise ??= invoke<string>("db_url").then((url) => Database.load(url)));

export interface SchoolProfile {
  region: string;
  division: string;
  district: string;
  school_name: string;
  school_id: string;
  teacher_name: string;
  school_head: string;
}

export interface SchoolYear {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  section_count: number;
}

export interface Section {
  id: number;
  school_year_id: number;
  grade_level: number;
  name: string;
  adviser: string;
  /** The teacher's own advisory class: imports and consolidates grades. */
  is_advisory: boolean;
  class_count: number;
  learner_count: number;
}

/** A learning area taught to one section. Section and year fields are joined in. */
export interface ClassRecord {
  id: number;
  section_id: number;
  learning_area: string;
  /** Senior High subject type (see SUBJECT_TYPES); "" below Grade 11. */
  subject_type: string;
  /** Terms the subject runs, e.g. "1,2,3". */
  terms: string;
  section: string;
  grade_level: number;
  school_year_id: number;
  school_year: string;
}

export type Sex = "M" | "F";

export interface Learner {
  id: number;
  section_id: number;
  lrn: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  sex: Sex;
  /** YYYY-MM-DD, or "" when unknown. */
  birthdate: string;
}

export interface Activity {
  id: number;
  class_id: number;
  term: Term;
  component: Component;
  position: number;
  highest_score: number;
}

export const scoreKey = (activityId: number, learnerId: number) => `${activityId}:${learnerId}`;

export interface Score {
  activity_id: number;
  learner_id: number;
  score: number;
}

// ---- School profile ----

export async function getProfile(): Promise<SchoolProfile> {
  const rows = await (await db()).select<SchoolProfile[]>(
    "SELECT region, division, district, school_name, school_id, teacher_name, school_head FROM school_profile WHERE id = 1",
  );
  return rows[0];
}

export async function saveProfile(p: SchoolProfile) {
  await (await db()).execute(
    `UPDATE school_profile SET region = $1, division = $2, district = $3,
       school_name = $4, school_id = $5, teacher_name = $6, school_head = $7 WHERE id = 1`,
    [p.region, p.division, p.district, p.school_name, p.school_id, p.teacher_name, p.school_head],
  );
}

// ---- School years ----

export async function listSchoolYears(): Promise<SchoolYear[]> {
  const rows = await (await db()).select<(Omit<SchoolYear, "is_active"> & { is_active: number })[]>(
    `SELECT sy.id, sy.name, sy.start_date, sy.end_date, sy.is_active,
       (SELECT COUNT(*) FROM sections s WHERE s.school_year_id = sy.id) AS section_count
     FROM school_years sy ORDER BY sy.name DESC`,
  );
  return rows.map((r) => ({ ...r, is_active: r.is_active === 1 }));
}

export type SchoolYearInput = Pick<SchoolYear, "name" | "start_date" | "end_date">;

/** The first school year created becomes the active one. */
export async function createSchoolYear(sy: SchoolYearInput): Promise<number> {
  const d = await db();
  const res = await d.execute(
    `INSERT INTO school_years (name, start_date, end_date, is_active)
     VALUES ($1, $2, $3, NOT EXISTS (SELECT 1 FROM school_years))`,
    [sy.name, sy.start_date, sy.end_date],
  );
  return res.lastInsertId as number;
}

export async function updateSchoolYear(id: number, sy: SchoolYearInput) {
  await (await db()).execute(
    "UPDATE school_years SET name = $1, start_date = $2, end_date = $3 WHERE id = $4",
    [sy.name, sy.start_date, sy.end_date, id],
  );
}

export async function setActiveSchoolYear(id: number) {
  await (await db()).execute("UPDATE school_years SET is_active = (id = $1)", [id]);
}

/** Deletes the school year with all its sections, classes and grades. */
export async function deleteSchoolYear(id: number) {
  const d = await db();
  await deleteClassesWhere("section_id IN (SELECT id FROM sections WHERE school_year_id = $1)", [id]);
  await deleteReceivedWhere("section_id IN (SELECT id FROM sections WHERE school_year_id = $1)", [id]);
  await d.execute(
    "DELETE FROM section_subject_order WHERE section_id IN (SELECT id FROM sections WHERE school_year_id = $1)",
    [id],
  );
  await d.execute(
    `DELETE FROM attendance_marks WHERE learner_id IN
       (SELECT l.id FROM learners l JOIN sections s ON s.id = l.section_id WHERE s.school_year_id = $1)`,
    [id],
  );
  await d.execute(
    "DELETE FROM attendance_no_class WHERE section_id IN (SELECT id FROM sections WHERE school_year_id = $1)",
    [id],
  );
  await d.execute(
    `DELETE FROM observed_values WHERE learner_id IN
       (SELECT l.id FROM learners l JOIN sections s ON s.id = l.section_id WHERE s.school_year_id = $1)`,
    [id],
  );
  await d.execute(
    "DELETE FROM learners WHERE section_id IN (SELECT id FROM sections WHERE school_year_id = $1)",
    [id],
  );
  await d.execute("DELETE FROM sections WHERE school_year_id = $1", [id]);
  await d.execute("DELETE FROM school_years WHERE id = $1", [id]);
  // Keep one active school year: fall back to the newest remaining.
  await d.execute(
    `UPDATE school_years SET is_active = 1
     WHERE NOT EXISTS (SELECT 1 FROM school_years WHERE is_active = 1)
       AND id = (SELECT id FROM school_years ORDER BY name DESC LIMIT 1)`,
  );
}

// ---- Sections ----

export async function listSections(schoolYearId: number): Promise<Section[]> {
  const rows = await (await db()).select<(Omit<Section, "is_advisory"> & { is_advisory: number })[]>(
    `SELECT s.id, s.school_year_id, s.grade_level, s.name, s.adviser, s.is_advisory,
       (SELECT COUNT(*) FROM classes c WHERE c.section_id = s.id) AS class_count,
       (SELECT COUNT(*) FROM learners l WHERE l.section_id = s.id) AS learner_count
     FROM sections s WHERE s.school_year_id = $1
     ORDER BY s.grade_level, s.name COLLATE NOCASE`,
    [schoolYearId],
  );
  return rows.map((r) => ({ ...r, is_advisory: r.is_advisory === 1 }));
}

export type SectionInput = Pick<Section, "school_year_id" | "grade_level" | "name" | "adviser" | "is_advisory">;

/** A teacher has one advisory class per school year: marking one clears the others. */
async function clearOtherAdvisory(s: SectionInput, exceptId: number) {
  if (!s.is_advisory) return;
  await (await db()).execute(
    "UPDATE sections SET is_advisory = 0 WHERE school_year_id = $1 AND id != $2",
    [s.school_year_id, exceptId],
  );
}

export async function createSection(s: SectionInput): Promise<number> {
  const res = await (await db()).execute(
    "INSERT INTO sections (school_year_id, grade_level, name, adviser, is_advisory) VALUES ($1, $2, $3, $4, $5)",
    [s.school_year_id, s.grade_level, s.name, s.adviser, s.is_advisory ? 1 : 0],
  );
  const id = res.lastInsertId as number;
  await clearOtherAdvisory(s, id);
  return id;
}

export async function updateSection(id: number, s: SectionInput) {
  await (await db()).execute(
    `UPDATE sections SET school_year_id = $1, grade_level = $2, name = $3, adviser = $4, is_advisory = $5
     WHERE id = $6`,
    [s.school_year_id, s.grade_level, s.name, s.adviser, s.is_advisory ? 1 : 0, id],
  );
  await clearOtherAdvisory(s, id);
}

/** Deletes the section with its learners, classes and grades. */
export async function deleteSection(id: number) {
  const d = await db();
  await deleteClassesWhere("section_id = $1", [id]);
  await deleteReceivedWhere("section_id = $1", [id]);
  await d.execute("DELETE FROM section_subject_order WHERE section_id = $1", [id]);
  await d.execute(
    "DELETE FROM attendance_marks WHERE learner_id IN (SELECT id FROM learners WHERE section_id = $1)",
    [id],
  );
  await d.execute("DELETE FROM attendance_no_class WHERE section_id = $1", [id]);
  await d.execute(
    "DELETE FROM observed_values WHERE learner_id IN (SELECT id FROM learners WHERE section_id = $1)",
    [id],
  );
  await d.execute("DELETE FROM learners WHERE section_id = $1", [id]);
  await d.execute("DELETE FROM sections WHERE id = $1", [id]);
}

// ---- Classes ----

const CLASS_SELECT = `
  SELECT c.id, c.section_id, c.learning_area, c.subject_type, c.terms,
    s.name AS section, s.grade_level, sy.id AS school_year_id, sy.name AS school_year
  FROM classes c
  JOIN sections s ON s.id = c.section_id
  JOIN school_years sy ON sy.id = s.school_year_id`;

export async function listClasses(schoolYearId: number): Promise<ClassRecord[]> {
  return (await db()).select<ClassRecord[]>(
    `${CLASS_SELECT} WHERE sy.id = $1
     ORDER BY s.grade_level, s.name COLLATE NOCASE, c.learning_area`,
    [schoolYearId],
  );
}

export type ClassInput = Pick<ClassRecord, "section_id" | "learning_area"> &
  Partial<Pick<ClassRecord, "subject_type" | "terms">>;

async function assertUniqueClass(c: ClassInput, exceptId = 0) {
  const rows = await (await db()).select<{ id: number }[]>(
    "SELECT id FROM classes WHERE section_id = $1 AND learning_area = $2 AND id != $3",
    [c.section_id, c.learning_area, exceptId],
  );
  if (rows.length) throw new Error(`This section already has a ${c.learning_area} class record.`);
}

/** Creates the class with one ST1, ST2 and TE slot per term. */
export async function createClass(c: ClassInput): Promise<number> {
  await assertUniqueClass(c);
  const d = await db();
  const res = await d.execute(
    "INSERT INTO classes (section_id, learning_area, subject_type, terms) VALUES ($1, $2, $3, $4)",
    [c.section_id, c.learning_area, c.subject_type ?? "", c.terms ?? "1,2,3"],
  );
  const classId = res.lastInsertId as number;
  for (const term of [1, 2, 3]) {
    for (const component of ["ST1", "ST2", "TE"]) {
      await d.execute(
        "INSERT INTO activities (class_id, term, component, position, highest_score) VALUES ($1, $2, $3, 1, 0)",
        [classId, term, component],
      );
    }
  }
  return classId;
}

/** Scores belong to the section's learners, so a scored class can't change section. */
export async function updateClass(id: number, c: ClassInput) {
  await assertUniqueClass(c, id);
  const [{ n }] = await (await db()).select<{ n: number }[]>(
    `SELECT COUNT(*) AS n FROM scores s JOIN activities a ON a.id = s.activity_id
     JOIN classes c ON c.id = a.class_id
     WHERE a.class_id = $1 AND c.section_id != $2`,
    [id, c.section_id],
  );
  if (n > 0) throw new Error("This class record already has scores, so it can't move to another section.");
  await (await db()).execute(
    "UPDATE classes SET section_id = $1, learning_area = $2, subject_type = $3, terms = $4 WHERE id = $5",
    [c.section_id, c.learning_area, c.subject_type ?? "", c.terms ?? "1,2,3", id],
  );
}

export async function deleteClass(classId: number) {
  await deleteClassesWhere("id = $1", [classId]);
}

// Children are deleted explicitly so nothing depends on the connection's
// foreign_keys setting.
async function deleteClassesWhere(where: string, params: unknown[]) {
  const d = await db();
  const ids = `SELECT id FROM classes WHERE ${where}`;
  await d.execute(`DELETE FROM descriptive_ratings WHERE class_id IN (${ids})`, params);
  await d.execute(
    `DELETE FROM scores WHERE activity_id IN (SELECT id FROM activities WHERE class_id IN (${ids}))`,
    params,
  );
  await d.execute(`DELETE FROM activities WHERE class_id IN (${ids})`, params);
  await d.execute(`DELETE FROM classes WHERE ${where}`, params);
}

// ---- Learners (per section, shared by its class records) ----

export async function listLearners(sectionId: number): Promise<Learner[]> {
  return (await db()).select<Learner[]>(
    `SELECT id, section_id, lrn, last_name, first_name, middle_name, sex, birthdate FROM learners
     WHERE section_id = $1
     ORDER BY sex DESC, last_name COLLATE NOCASE, first_name COLLATE NOCASE`,
    [sectionId],
  );
}

export type NewLearner = Omit<Learner, "id" | "section_id" | "birthdate"> & { birthdate?: string };

export async function addLearners(sectionId: number, learners: NewLearner[]) {
  const d = await db();
  for (const l of learners) {
    await d.execute(
      `INSERT INTO learners (section_id, lrn, last_name, first_name, middle_name, sex, birthdate)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [sectionId, l.lrn, l.last_name, l.first_name, l.middle_name, l.sex, l.birthdate ?? ""],
    );
  }
}

export async function updateLearner(l: Learner) {
  await (await db()).execute(
    `UPDATE learners SET lrn = $1, last_name = $2, first_name = $3, middle_name = $4, sex = $5, birthdate = $6
     WHERE id = $7`,
    [l.lrn, l.last_name, l.first_name, l.middle_name, l.sex, l.birthdate, l.id],
  );
}

/** Removes the learner from the section, with their scores in every class record. */
export async function deleteLearner(learnerId: number) {
  const d = await db();
  await d.execute("DELETE FROM attendance_marks WHERE learner_id = $1", [learnerId]);
  await d.execute("DELETE FROM observed_values WHERE learner_id = $1", [learnerId]);
  await d.execute("DELETE FROM descriptive_ratings WHERE learner_id = $1", [learnerId]);
  await d.execute("DELETE FROM received_grade_rows WHERE learner_id = $1", [learnerId]);
  await d.execute("DELETE FROM scores WHERE learner_id = $1", [learnerId]);
  await d.execute("DELETE FROM learners WHERE id = $1", [learnerId]);
}

/** Number of scores a learner has across all class records. */
export async function countLearnerScores(learnerId: number): Promise<number> {
  const [{ n }] = await (await db()).select<{ n: number }[]>(
    "SELECT COUNT(*) AS n FROM scores WHERE learner_id = $1",
    [learnerId],
  );
  return n;
}

// ---- Activities and scores ----

export async function listActivities(classId: number): Promise<Activity[]> {
  return (await db()).select<Activity[]>(
    `SELECT id, class_id, term, component, position, highest_score FROM activities
     WHERE class_id = $1 ORDER BY term, component, position`,
    [classId],
  );
}

export async function addActivity(
  classId: number,
  term: Term,
  component: "WW" | "PT",
): Promise<Activity> {
  const d = await db();
  const [{ next }] = await d.select<{ next: number }[]>(
    `SELECT COALESCE(MAX(position), 0) + 1 AS next FROM activities
     WHERE class_id = $1 AND term = $2 AND component = $3`,
    [classId, term, component],
  );
  const res = await d.execute(
    "INSERT INTO activities (class_id, term, component, position, highest_score) VALUES ($1, $2, $3, $4, 0)",
    [classId, term, component, next],
  );
  return {
    id: res.lastInsertId as number,
    class_id: classId,
    term,
    component,
    position: next,
    highest_score: 0,
  };
}

export async function setHighestScore(activityId: number, hps: number) {
  await (await db()).execute(
    "UPDATE activities SET highest_score = $1 WHERE id = $2",
    [hps, activityId],
  );
}

export async function deleteActivity(activityId: number) {
  const d = await db();
  await d.execute("DELETE FROM scores WHERE activity_id = $1", [activityId]);
  await d.execute("DELETE FROM activities WHERE id = $1", [activityId]);
}

export async function listScores(classId: number): Promise<Score[]> {
  return (await db()).select<Score[]>(
    `SELECT s.activity_id, s.learner_id, s.score FROM scores s
     JOIN activities a ON a.id = s.activity_id WHERE a.class_id = $1`,
    [classId],
  );
}

/** null clears the score. */
export async function setScore(activityId: number, learnerId: number, score: number | null) {
  const d = await db();
  if (score === null) {
    await d.execute("DELETE FROM scores WHERE activity_id = $1 AND learner_id = $2", [
      activityId,
      learnerId,
    ]);
  } else {
    await d.execute(
      `INSERT INTO scores (activity_id, learner_id, score) VALUES ($1, $2, $3)
       ON CONFLICT (activity_id, learner_id) DO UPDATE SET score = excluded.score`,
      [activityId, learnerId, score],
    );
  }
}

// ---- Received grades (imported .twig files) ----

export interface ReceivedGrade {
  id: number;
  section_id: number;
  learning_area: string;
  teacher_name: string;
  exported_at: string;
  imported_at: string;
  checksum: string;
}

export interface ReceivedRow {
  received_id: number;
  learner_id: number;
  // Numbers for numeric grading, codes such as "A" for descriptive grading.
  term1: number | string | null;
  term2: number | string | null;
  term3: number | string | null;
  final: number | string | null;
}

export async function listReceived(sectionId: number): Promise<{ grades: ReceivedGrade[]; rows: ReceivedRow[] }> {
  const d = await db();
  const [grades, rows] = await Promise.all([
    d.select<ReceivedGrade[]>(
      `SELECT id, section_id, learning_area, teacher_name, exported_at, imported_at, checksum
       FROM received_grades WHERE section_id = $1`,
      [sectionId],
    ),
    d.select<ReceivedRow[]>(
      `SELECT r.received_id, r.learner_id, r.term1, r.term2, r.term3, r.final
       FROM received_grade_rows r JOIN received_grades g ON g.id = r.received_id
       WHERE g.section_id = $1`,
      [sectionId],
    ),
  ]);
  return { grades, rows };
}

export interface ReceivedInput {
  section_id: number;
  learning_area: string;
  teacher_name: string;
  exported_at: string;
  checksum: string;
  rows: { learner_id: number; terms: (number | string | null)[]; final: number | string | null }[];
}

/** Stores imported grades, replacing any earlier file for the same learning area. */
export async function saveReceived(r: ReceivedInput) {
  const d = await db();
  await deleteReceivedWhere("section_id = $1 AND learning_area = $2", [r.section_id, r.learning_area]);
  const res = await d.execute(
    `INSERT INTO received_grades (section_id, learning_area, teacher_name, exported_at, checksum)
     VALUES ($1, $2, $3, $4, $5)`,
    [r.section_id, r.learning_area, r.teacher_name, r.exported_at, r.checksum],
  );
  const id = res.lastInsertId as number;
  for (const row of r.rows) {
    await d.execute(
      `INSERT INTO received_grade_rows (received_id, learner_id, term1, term2, term3, final)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, row.learner_id, row.terms[0] ?? null, row.terms[1] ?? null, row.terms[2] ?? null, row.final],
    );
  }
}

export async function deleteReceived(id: number) {
  await deleteReceivedWhere("id = $1", [id]);
}

async function deleteReceivedWhere(where: string, params: unknown[]) {
  const d = await db();
  await d.execute(
    `DELETE FROM received_grade_rows WHERE received_id IN (SELECT id FROM received_grades WHERE ${where})`,
    params,
  );
  await d.execute(`DELETE FROM received_grades WHERE ${where}`, params);
}

/** Learning areas with imported grades, for every section in a school year. */
export async function listReceivedAreas(
  schoolYearId: number,
): Promise<{ section_id: number; learning_area: string }[]> {
  return (await db()).select(
    `SELECT g.section_id, g.learning_area FROM received_grades g
     JOIN sections s ON s.id = g.section_id WHERE s.school_year_id = $1`,
    [schoolYearId],
  );
}

// ---- Subject order (report card) ----

/** Saved learning-area order for a section; empty when never customized. */
export async function getSubjectOrder(sectionId: number): Promise<string[]> {
  const rows = await (await db()).select<{ learning_area: string }[]>(
    "SELECT learning_area FROM section_subject_order WHERE section_id = $1 ORDER BY position",
    [sectionId],
  );
  return rows.map((r) => r.learning_area);
}

export async function saveSubjectOrder(sectionId: number, areas: string[]) {
  const d = await db();
  await d.execute("DELETE FROM section_subject_order WHERE section_id = $1", [sectionId]);
  for (const [i, area] of areas.entries()) {
    await d.execute(
      "INSERT INTO section_subject_order (section_id, learning_area, position) VALUES ($1, $2, $3)",
      [sectionId, area, i],
    );
  }
}

// ---- Attendance (advisory class, SF2-style) ----

export type AttendanceStatus = "A" | "L";

export interface AttendanceMark {
  learner_id: number;
  date: string;
  status: AttendanceStatus;
}

export async function listNoClassDays(sectionId: number): Promise<string[]> {
  const rows = await (await db()).select<{ date: string }[]>(
    "SELECT date FROM attendance_no_class WHERE section_id = $1 ORDER BY date",
    [sectionId],
  );
  return rows.map((r) => r.date);
}

export async function setNoClassDay(sectionId: number, date: string, noClass: boolean) {
  await (await db()).execute(
    noClass
      ? "INSERT OR IGNORE INTO attendance_no_class (section_id, date) VALUES ($1, $2)"
      : "DELETE FROM attendance_no_class WHERE section_id = $1 AND date = $2",
    [sectionId, date],
  );
}

export async function listAttendanceMarks(sectionId: number): Promise<AttendanceMark[]> {
  return (await db()).select<AttendanceMark[]>(
    `SELECT m.learner_id, m.date, m.status FROM attendance_marks m
     JOIN learners l ON l.id = m.learner_id WHERE l.section_id = $1`,
    [sectionId],
  );
}

/** null marks the learner present (the default). */
export async function setAttendanceMark(learnerId: number, date: string, status: AttendanceStatus | null) {
  const d = await db();
  if (status === null) {
    await d.execute("DELETE FROM attendance_marks WHERE learner_id = $1 AND date = $2", [learnerId, date]);
  } else {
    await d.execute(
      `INSERT INTO attendance_marks (learner_id, date, status) VALUES ($1, $2, $3)
       ON CONFLICT (learner_id, date) DO UPDATE SET status = excluded.status`,
      [learnerId, date, status],
    );
  }
}

// ---- Observed values (SF9 core values, advisory class) ----

export type Marking = "AO" | "SO" | "RO" | "NO";

export interface ObservedValue {
  learner_id: number;
  term: number;
  behavior: string;
  marking: Marking;
}

export async function listObservedValues(sectionId: number): Promise<ObservedValue[]> {
  return (await db()).select<ObservedValue[]>(
    `SELECT v.learner_id, v.term, v.behavior, v.marking FROM observed_values v
     JOIN learners l ON l.id = v.learner_id WHERE l.section_id = $1`,
    [sectionId],
  );
}

/** null clears the marking. */
export async function setObservedValue(learnerId: number, term: number, behavior: string, marking: Marking | null) {
  const d = await db();
  if (marking === null) {
    await d.execute("DELETE FROM observed_values WHERE learner_id = $1 AND term = $2 AND behavior = $3", [
      learnerId,
      term,
      behavior,
    ]);
  } else {
    await d.execute(
      `INSERT INTO observed_values (learner_id, term, behavior, marking) VALUES ($1, $2, $3, $4)
       ON CONFLICT (learner_id, term, behavior) DO UPDATE SET marking = excluded.marking`,
      [learnerId, term, behavior, marking],
    );
  }
}

// ---- Descriptive ratings (Grades 1-3 descriptive, Kindergarten) ----

export interface DescriptiveRating {
  learner_id: number;
  /** 1-3; 4 = final. */
  term: number;
  /** "" for a learning area's descriptor; a domain key for Kindergarten. */
  item: string;
  code: string;
}

export async function listDescriptive(classId: number): Promise<DescriptiveRating[]> {
  return (await db()).select<DescriptiveRating[]>(
    "SELECT learner_id, term, item, code FROM descriptive_ratings WHERE class_id = $1",
    [classId],
  );
}

/** null clears the rating. */
export async function setDescriptive(classId: number, learnerId: number, term: number, item: string, code: string | null) {
  const d = await db();
  if (code === null) {
    await d.execute(
      "DELETE FROM descriptive_ratings WHERE class_id = $1 AND learner_id = $2 AND term = $3 AND item = $4",
      [classId, learnerId, term, item],
    );
  } else {
    await d.execute(
      `INSERT INTO descriptive_ratings (class_id, learner_id, term, item, code) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (class_id, learner_id, term, item) DO UPDATE SET code = excluded.code`,
      [classId, learnerId, term, item, code],
    );
  }
}
