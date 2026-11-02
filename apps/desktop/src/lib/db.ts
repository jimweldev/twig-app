import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import { parseFields, type CertField, type CertKind, type Recipients } from "@/certificates/fields";
import type { Component, Term } from "@/ecr/grading";
import { partsOf } from "@/ecr/levels";
import type { LessonPlan, PlanContent } from "@/lessons/plan";
import type { Quiz, QuizContent } from "@/quizzes/quiz";

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
  /** The school's short name, e.g. FGNMHS; optional. */
  school_acronym: string;
  /** Printed under the school name on lesson plans. */
  address: string;
  teacher_name: string;
  school_head: string;
  /** e.g. Teacher III; filled in as "Prepared by" on new lesson plans. */
  teacher_position: string;
  /** e.g. Principal IV; under the school head's signature. */
  school_head_position: string;
  /** Who checks lesson plans, e.g. the head teacher, and their position. */
  checker_name: string;
  checker_position: string;
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
  /** Who teaches it: blank for you, else another teacher's name. */
  teacher: string;
  /** The subject's own grading weights as JSON (see parseCustomScheme); blank for DepEd's. */
  weights: string;
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
  /** The part of the learning area it scores (MAPEH: "MA" or "PEH"); "" for most. */
  part: string;
}

export const scoreKey = (activityId: number, learnerId: number) => `${activityId}:${learnerId}`;

export interface Score {
  activity_id: number;
  learner_id: number;
  score: number;
}

// ---- School profile ----

export async function getProfile(): Promise<SchoolProfile> {
  const rows = await (
    await db()
  ).select<SchoolProfile[]>(
    `SELECT region, division, district, school_name, school_id, address, teacher_name, school_head,
       teacher_position, school_head_position, checker_name, checker_position, school_acronym
       FROM school_profile WHERE id = 1`,
  );
  return rows[0];
}

export async function saveProfile(p: SchoolProfile) {
  await (
    await db()
  ).execute(
    `UPDATE school_profile SET region = $1, division = $2, district = $3,
       school_name = $4, school_id = $5, teacher_name = $6, school_head = $7, address = $8,
       teacher_position = $9, school_head_position = $10, checker_name = $11, checker_position = $12,
       school_acronym = $13 WHERE id = 1`,
    [
      p.region,
      p.division,
      p.district,
      p.school_name,
      p.school_id,
      p.teacher_name,
      p.school_head,
      p.address,
      p.teacher_position,
      p.school_head_position,
      p.checker_name,
      p.checker_position,
      p.school_acronym,
    ],
  );
}

// ---- Lesson plan footer ----

/** Images printed at the bottom of every lesson plan page, as data: URLs, left to right on each side. */
export interface LessonFooter {
  left: string[];
  right: string[];
}

export async function getLessonFooter(): Promise<LessonFooter> {
  const rows = await (
    await db()
  ).select<{ lesson_footer: string }[]>("SELECT lesson_footer FROM school_profile WHERE id = 1");
  try {
    const f = JSON.parse(rows[0]?.lesson_footer ?? "{}");
    return { left: Array.isArray(f.left) ? f.left : [], right: Array.isArray(f.right) ? f.right : [] };
  } catch {
    return { left: [], right: [] };
  }
}

export async function saveLessonFooter(footer: LessonFooter) {
  await (await db()).execute("UPDATE school_profile SET lesson_footer = $1 WHERE id = 1", [JSON.stringify(footer)]);
}

// ---- School years ----

export async function listSchoolYears(): Promise<SchoolYear[]> {
  const rows = await (
    await db()
  ).select<(Omit<SchoolYear, "is_active"> & { is_active: number })[]>(
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
  await (
    await db()
  ).execute("UPDATE school_years SET name = $1, start_date = $2, end_date = $3 WHERE id = $4", [
    sy.name,
    sy.start_date,
    sy.end_date,
    id,
  ]);
}

export async function setActiveSchoolYear(id: number) {
  await (await db()).execute("UPDATE school_years SET is_active = (id = $1)", [id]);
}

/** Deletes the school year with all its sections, classes and grades. */
export async function deleteSchoolYear(id: number) {
  const d = await db();
  await deleteClassesWhere("section_id IN (SELECT id FROM sections WHERE school_year_id = $1)", [id]);
  await deleteReceivedWhere("section_id IN (SELECT id FROM sections WHERE school_year_id = $1)", [id]);
  await (
    await db()
  ).execute("DELETE FROM saved_groups WHERE section_id IN (SELECT id FROM sections WHERE school_year_id = $1)", [id]);
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
  await d.execute("DELETE FROM learners WHERE section_id IN (SELECT id FROM sections WHERE school_year_id = $1)", [id]);
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
  const rows = await (
    await db()
  ).select<(Omit<Section, "is_advisory"> & { is_advisory: number })[]>(
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
  await (
    await db()
  ).execute("UPDATE sections SET is_advisory = 0 WHERE school_year_id = $1 AND id != $2", [s.school_year_id, exceptId]);
}

export async function createSection(s: SectionInput): Promise<number> {
  const res = await (
    await db()
  ).execute(
    "INSERT INTO sections (school_year_id, grade_level, name, adviser, is_advisory) VALUES ($1, $2, $3, $4, $5)",
    [s.school_year_id, s.grade_level, s.name, s.adviser, s.is_advisory ? 1 : 0],
  );
  const id = res.lastInsertId as number;
  await clearOtherAdvisory(s, id);
  return id;
}

export async function updateSection(id: number, s: SectionInput) {
  await (
    await db()
  ).execute(
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
  await d.execute("DELETE FROM saved_groups WHERE section_id = $1", [id]);
  await d.execute("DELETE FROM attendance_marks WHERE learner_id IN (SELECT id FROM learners WHERE section_id = $1)", [
    id,
  ]);
  await d.execute("DELETE FROM attendance_no_class WHERE section_id = $1", [id]);
  await d.execute("DELETE FROM observed_values WHERE learner_id IN (SELECT id FROM learners WHERE section_id = $1)", [
    id,
  ]);
  await d.execute("DELETE FROM learners WHERE section_id = $1", [id]);
  await d.execute("DELETE FROM sections WHERE id = $1", [id]);
}

// ---- Classes ----

const CLASS_SELECT = `
  SELECT c.id, c.section_id, c.learning_area, c.subject_type, c.terms, c.teacher, c.weights,
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
  Partial<Pick<ClassRecord, "subject_type" | "terms" | "teacher" | "weights">>;

async function assertUniqueClass(c: ClassInput, exceptId = 0) {
  const rows = await (
    await db()
  ).select<{ id: number }[]>("SELECT id FROM classes WHERE section_id = $1 AND learning_area = $2 AND id != $3", [
    c.section_id,
    c.learning_area,
    exceptId,
  ]);
  if (rows.length) throw new Error(`This section already has a ${c.learning_area} class record.`);
}

/** One ST1, ST2 and TE slot per term, and per part when the learning area has parts. */
async function addExamSlots(classId: number, learningArea: string) {
  const d = await db();
  const parts = partsOf(learningArea).map((p) => p.id);
  for (const part of parts.length ? parts : [""]) {
    for (const term of [1, 2, 3]) {
      for (const component of ["ST1", "ST2", "TE"]) {
        await d.execute(
          "INSERT INTO activities (class_id, term, component, position, highest_score, part) VALUES ($1, $2, $3, 1, 0, $4)",
          [classId, term, component, part],
        );
      }
    }
  }
}

/** Creates the class with its exam slots. */
export async function createClass(c: ClassInput): Promise<number> {
  await assertUniqueClass(c);
  const d = await db();
  const res = await d.execute(
    "INSERT INTO classes (section_id, learning_area, subject_type, terms, teacher, weights) VALUES ($1, $2, $3, $4, $5, $6)",
    [c.section_id, c.learning_area, c.subject_type ?? "", c.terms ?? "1,2,3", c.teacher?.trim() ?? "", c.weights ?? ""],
  );
  const classId = res.lastInsertId as number;
  await addExamSlots(classId, c.learning_area);
  return classId;
}

/** Scores belong to the section's learners, so a scored class can't change section. */
export async function updateClass(id: number, c: ClassInput) {
  await assertUniqueClass(c, id);
  const [{ n }] = await (
    await db()
  ).select<{ n: number }[]>(
    `SELECT COUNT(*) AS n FROM scores s JOIN activities a ON a.id = s.activity_id
     JOIN classes c ON c.id = a.class_id
     WHERE a.class_id = $1 AND c.section_id != $2`,
    [id, c.section_id],
  );
  if (n > 0) throw new Error("This class record already has scores, so it can't move to another section.");
  // Moving to or from MAPEH changes how the sheets are split: start them over while nothing is scored.
  const d = await db();
  const [old] = await d.select<{ learning_area: string }[]>("SELECT learning_area FROM classes WHERE id = $1", [id]);
  const partIds = (area: string) =>
    partsOf(area)
      .map((p) => p.id)
      .join(",");
  const resplit = old !== undefined && partIds(old.learning_area) !== partIds(c.learning_area);
  if (resplit) {
    const [{ scored }] = await d.select<{ scored: number }[]>(
      "SELECT COUNT(*) AS scored FROM scores s JOIN activities a ON a.id = s.activity_id WHERE a.class_id = $1",
      [id],
    );
    if (scored > 0)
      throw new Error(
        "This class record already has scores, so it can't change to or from MAPEH. Make a new class record instead.",
      );
  }
  await d.execute(
    "UPDATE classes SET section_id = $1, learning_area = $2, subject_type = $3, terms = $4, weights = $5 WHERE id = $6",
    [c.section_id, c.learning_area, c.subject_type ?? "", c.terms ?? "1,2,3", c.weights ?? "", id],
  );
  if (resplit) {
    await d.execute("DELETE FROM activities WHERE class_id = $1", [id]);
    await addExamSlots(id, c.learning_area);
  }
}

/** Who teaches a subject: blank for you. */
export async function setClassTeacher(classId: number, teacher: string) {
  await (await db()).execute("UPDATE classes SET teacher = $1 WHERE id = $2", [teacher.trim(), classId]);
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
  await d.execute(`DELETE FROM finalized_terms WHERE class_id IN (${ids})`, params);
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
  await (
    await db()
  ).execute(
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
  const [{ n }] = await (
    await db()
  ).select<{ n: number }[]>("SELECT COUNT(*) AS n FROM scores WHERE learner_id = $1", [learnerId]);
  return n;
}

// ---- Activities and scores ----

export async function listActivities(classId: number): Promise<Activity[]> {
  return (await db()).select<Activity[]>(
    `SELECT id, class_id, term, component, position, highest_score, part FROM activities
     WHERE class_id = $1 ORDER BY term, part, component, position`,
    [classId],
  );
}

export async function addActivity(classId: number, term: Term, component: "WW" | "PT", part = ""): Promise<Activity> {
  const d = await db();
  const [{ next }] = await d.select<{ next: number }[]>(
    `SELECT COALESCE(MAX(position), 0) + 1 AS next FROM activities
     WHERE class_id = $1 AND term = $2 AND component = $3 AND part = $4`,
    [classId, term, component, part],
  );
  const res = await d.execute(
    "INSERT INTO activities (class_id, term, component, position, highest_score, part) VALUES ($1, $2, $3, $4, 0, $5)",
    [classId, term, component, next, part],
  );
  return {
    id: res.lastInsertId as number,
    class_id: classId,
    term,
    component,
    position: next,
    highest_score: 0,
    part,
  };
}

export async function setHighestScore(activityId: number, hps: number) {
  await (await db()).execute("UPDATE activities SET highest_score = $1 WHERE id = $2", [hps, activityId]);
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
    await d.execute("DELETE FROM scores WHERE activity_id = $1 AND learner_id = $2", [activityId, learnerId]);
  } else {
    await d.execute(
      `INSERT INTO scores (activity_id, learner_id, score) VALUES ($1, $2, $3)
       ON CONFLICT (activity_id, learner_id) DO UPDATE SET score = excluded.score`,
      [activityId, learnerId, score],
    );
  }
}

export interface ImportedActivity {
  component: Component;
  position: number;
  highest_score: number;
  /** As on Activity; absent in files from before MAPEH had parts. */
  part?: string;
  /** Learner id → score. */
  scores: Map<number, number>;
}

/**
 * Replaces one term's activities and scores with imported ones. Each exam slot the
 * class always has (ST1, ST2, TE, per part) is kept, empty, when the import has none.
 * Activities from a record without parts go to the first part (MAPEH: Music and Arts).
 * With onlyPart, only that part's activities are replaced and everything imported goes there.
 */
export async function replaceTermScores(classId: number, term: Term, imported: ImportedActivity[], onlyPart?: string) {
  const d = await db();
  const [cls] = await d.select<{ learning_area: string }[]>("SELECT learning_area FROM classes WHERE id = $1", [
    classId,
  ]);
  const parts = onlyPart ? [onlyPart] : partsOf(cls?.learning_area ?? "").map((p) => p.id);
  const only = onlyPart ? " AND part = $3" : "";
  const params = onlyPart ? [classId, term, onlyPart] : [classId, term];
  const partOf = (a: ImportedActivity) =>
    parts.length === 0 ? "" : parts.includes(a.part ?? "") ? (a.part as string) : parts[0];
  const activities = imported.map((a) => ({ ...a, part: partOf(a) }));
  await d.execute(
    `DELETE FROM scores WHERE activity_id IN (SELECT id FROM activities WHERE class_id = $1 AND term = $2${only})`,
    params,
  );
  await d.execute(`DELETE FROM activities WHERE class_id = $1 AND term = $2${only}`, params);
  const exams = (parts.length ? parts : [""]).flatMap((part) =>
    (["ST1", "ST2", "TE"] as const)
      .filter((c) => !activities.some((a) => a.component === c && a.part === part))
      .map((component) => ({ component, position: 1, highest_score: 0, part, scores: new Map<number, number>() })),
  );
  for (const a of [...activities, ...exams]) {
    const res = await d.execute(
      "INSERT INTO activities (class_id, term, component, position, highest_score, part) VALUES ($1, $2, $3, $4, $5, $6)",
      [classId, term, a.component, a.position, a.highest_score, a.part],
    );
    for (const [learnerId, score] of a.scores) {
      await d.execute("INSERT INTO scores (activity_id, learner_id, score) VALUES ($1, $2, $3)", [
        res.lastInsertId as number,
        learnerId,
        score,
      ]);
    }
  }
}

/** Clears imported term grades that imported scores now replace; drops the import when nothing is left. */
export async function clearReceivedTerms(sectionId: number, learningArea: string, terms: number[]) {
  const d = await db();
  const [row] = await d.select<{ id: number }[]>(
    "SELECT id FROM received_grades WHERE section_id = $1 AND learning_area = $2",
    [sectionId, learningArea],
  );
  if (!row) return;
  const cols = terms.filter((t) => t >= 1 && t <= 3).map((t) => `term${t} = NULL`);
  if (cols.length === 0) return;
  await d.execute(`UPDATE received_grade_rows SET ${cols.join(", ")}, final = NULL WHERE received_id = $1`, [row.id]);
  const [{ remaining }] = await d.select<{ remaining: number }[]>(
    `SELECT COUNT(*) AS remaining FROM received_grade_rows
     WHERE received_id = $1 AND (term1 IS NOT NULL OR term2 IS NOT NULL OR term3 IS NOT NULL)`,
    [row.id],
  );
  if (remaining === 0) await deleteReceived(row.id);
}

/** What an import may change, saved first so the import can be undone. */
export interface ImportSnapshot {
  sectionId: number;
  learningArea: string;
  learnerIds: number[];
  received: Omit<ReceivedInput, "terms"> | null;
  classId?: number;
  terms: { term: Term; activities: ImportedActivity[] }[];
}

export async function snapshotImport(
  sectionId: number,
  learningArea: string,
  classId: number | undefined,
  terms: Term[],
): Promise<ImportSnapshot> {
  const [learners, received] = await Promise.all([listLearners(sectionId), listReceived(sectionId)]);
  const info = received.grades.find((g) => g.learning_area === learningArea);
  const snapshot: ImportSnapshot = {
    sectionId,
    learningArea,
    learnerIds: learners.map((l) => l.id),
    received: info
      ? {
          section_id: sectionId,
          learning_area: learningArea,
          teacher_name: info.teacher_name,
          exported_at: info.exported_at,
          checksum: info.checksum,
          rows: received.rows
            .filter((r) => r.received_id === info.id)
            .map((r) => ({ learner_id: r.learner_id, terms: [r.term1, r.term2, r.term3], final: r.final })),
        }
      : null,
    classId,
    terms: [],
  };
  if (classId !== undefined && terms.length > 0) {
    const [acts, scores] = await Promise.all([listActivities(classId), listScores(classId)]);
    snapshot.terms = terms.map((term) => ({
      term,
      activities: acts
        .filter((a) => a.term === term)
        .map((a) => ({
          component: a.component,
          position: a.position,
          highest_score: a.highest_score,
          part: a.part,
          scores: new Map(scores.filter((s) => s.activity_id === a.id).map((s) => [s.learner_id, s.score])),
        })),
    }));
  }
  return snapshot;
}

/** Puts back what an import changed, and removes learners it added. */
export async function restoreImport(s: ImportSnapshot) {
  if (s.classId !== undefined) {
    for (const t of s.terms) await replaceTermScores(s.classId, t.term, t.activities);
  }
  await deleteReceivedWhere("section_id = $1 AND learning_area = $2", [s.sectionId, s.learningArea]);
  if (s.received) await saveReceived({ ...s.received, terms: [1, 2, 3] });
  const added = (await listLearners(s.sectionId)).filter((l) => !s.learnerIds.includes(l.id));
  for (const l of added) await deleteLearner(l.id);
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
  /** Terms (1-3) to write. Grades already imported for other terms are kept. */
  terms: number[];
  rows: { learner_id: number; terms: (number | string | null)[]; final: number | string | null }[];
}

/**
 * Stores imported grades for the chosen terms. Other terms already imported for the
 * learning area stay; the final grade always comes from the newest import.
 */
export async function saveReceived(r: ReceivedInput) {
  const d = await db();
  const [existing] = await d.select<{ id: number }[]>(
    "SELECT id FROM received_grades WHERE section_id = $1 AND learning_area = $2",
    [r.section_id, r.learning_area],
  );
  let id: number;
  if (existing) {
    id = existing.id;
    await d.execute(
      `UPDATE received_grades SET teacher_name = $1, exported_at = $2, checksum = $3, imported_at = datetime('now')
       WHERE id = $4`,
      [r.teacher_name, r.exported_at, r.checksum, id],
    );
  } else {
    const res = await d.execute(
      `INSERT INTO received_grades (section_id, learning_area, teacher_name, exported_at, checksum)
       VALUES ($1, $2, $3, $4, $5)`,
      [r.section_id, r.learning_area, r.teacher_name, r.exported_at, r.checksum],
    );
    id = res.lastInsertId as number;
  }

  const columns = [...r.terms.filter((t) => t >= 1 && t <= 3).map((t) => `term${t}`), "final"];
  const sql = `INSERT INTO received_grade_rows (received_id, learner_id, ${columns.join(", ")})
     VALUES ($1, $2, ${columns.map((_, i) => `$${i + 3}`).join(", ")})
     ON CONFLICT (received_id, learner_id) DO UPDATE SET ${columns.map((c) => `${c} = excluded.${c}`).join(", ")}`;
  for (const row of r.rows) {
    const values = r.terms.filter((t) => t >= 1 && t <= 3).map((t) => row.terms[t - 1] ?? null);
    await d.execute(sql, [id, row.learner_id, ...values, row.final]);
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

/**
 * The terms (1-3) of each learning area of a section that have at least one grade: a
 * score or rating in this computer's class record, or an imported term grade.
 */
export async function listGradedTerms(sectionId: number): Promise<Map<string, Set<number>>> {
  const rows = await (
    await db()
  ).select<{ learning_area: string; term: number }[]>(
    `SELECT c.learning_area, a.term FROM classes c
       JOIN activities a ON a.class_id = c.id JOIN scores s ON s.activity_id = a.id
       WHERE c.section_id = $1
     UNION
     SELECT c.learning_area, r.term FROM classes c JOIN descriptive_ratings r ON r.class_id = c.id
       WHERE c.section_id = $1 AND r.term BETWEEN 1 AND 3
     UNION
     SELECT g.learning_area, t.term FROM received_grades g
       JOIN received_grade_rows r ON r.received_id = g.id
       JOIN (SELECT 1 AS term UNION SELECT 2 UNION SELECT 3) t
       WHERE g.section_id = $1
         AND CASE t.term WHEN 1 THEN r.term1 WHEN 2 THEN r.term2 ELSE r.term3 END IS NOT NULL`,
    [sectionId],
  );
  const terms = new Map<string, Set<number>>();
  for (const r of rows) terms.set(r.learning_area, (terms.get(r.learning_area) ?? new Set()).add(r.term));
  return terms;
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
  const rows = await (
    await db()
  ).select<{ learning_area: string }[]>(
    "SELECT learning_area FROM section_subject_order WHERE section_id = $1 ORDER BY position",
    [sectionId],
  );
  return rows.map((r) => r.learning_area);
}

export async function saveSubjectOrder(sectionId: number, areas: string[]) {
  const d = await db();
  await d.execute("DELETE FROM section_subject_order WHERE section_id = $1", [sectionId]);
  for (const [i, area] of areas.entries()) {
    await d.execute("INSERT INTO section_subject_order (section_id, learning_area, position) VALUES ($1, $2, $3)", [
      sectionId,
      area,
      i,
    ]);
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
  const rows = await (
    await db()
  ).select<{ date: string }[]>("SELECT date FROM attendance_no_class WHERE section_id = $1 ORDER BY date", [sectionId]);
  return rows.map((r) => r.date);
}

export async function setNoClassDay(sectionId: number, date: string, noClass: boolean) {
  await (
    await db()
  ).execute(
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
export async function setDescriptive(
  classId: number,
  learnerId: number,
  term: number,
  item: string,
  code: string | null,
) {
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

// ---- Certificates ----

export interface CertificateTemplate {
  id: number;
  name: string;
  /** data: URL of the uploaded design. */
  image: string;
  width: number;
  height: number;
  fields: CertField[];
  /** Who gets one when printing. */
  recipients: Recipients;
  /** What the certificate is for. */
  kind: CertKind;
}

type CertificateRow = Omit<CertificateTemplate, "fields"> & { fields: string };

const parseCertificate = (r: CertificateRow): CertificateTemplate => ({ ...r, fields: parseFields(r.fields) });

export async function listCertificateTemplates(): Promise<CertificateTemplate[]> {
  const rows = await (
    await db()
  ).select<CertificateRow[]>(
    "SELECT id, name, image, width, height, fields, recipients, kind FROM certificate_templates ORDER BY updated_at DESC, id DESC",
  );
  return rows.map(parseCertificate);
}

export async function getCertificateTemplate(id: number): Promise<CertificateTemplate | null> {
  const [row] = await (
    await db()
  ).select<CertificateRow[]>(
    "SELECT id, name, image, width, height, fields, recipients, kind FROM certificate_templates WHERE id = $1",
    [id],
  );
  return row ? parseCertificate(row) : null;
}

export type CertificateImage = Pick<CertificateTemplate, "image" | "width" | "height">;

export async function createCertificateTemplate(
  name: string,
  img: CertificateImage,
  t: Pick<CertificateTemplate, "fields" | "recipients" | "kind">,
): Promise<number> {
  const res = await (
    await db()
  ).execute(
    `INSERT INTO certificate_templates (name, image, width, height, fields, recipients, kind)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [name, img.image, img.width, img.height, JSON.stringify(t.fields), t.recipients, t.kind],
  );
  return res.lastInsertId as number;
}

export async function updateCertificateTemplate(
  id: number,
  t: Pick<CertificateTemplate, "name" | "fields" | "recipients" | "kind">,
) {
  await (
    await db()
  ).execute(
    `UPDATE certificate_templates SET name = $1, fields = $2, recipients = $3, kind = $4, updated_at = datetime('now')
     WHERE id = $5`,
    [t.name, JSON.stringify(t.fields), t.recipients, t.kind, id],
  );
}

/** Swaps the design; placed fields keep their positions. */
export async function replaceCertificateImage(id: number, img: CertificateImage) {
  await (
    await db()
  ).execute(
    "UPDATE certificate_templates SET image = $1, width = $2, height = $3, updated_at = datetime('now') WHERE id = $4",
    [img.image, img.width, img.height, id],
  );
}

export async function deleteCertificateTemplate(id: number) {
  await (await db()).execute("DELETE FROM certificate_templates WHERE id = $1", [id]);
}

// ---- Lesson plans ----

type LessonPlanRow = Omit<LessonPlan, "content"> & { content: string };

function parseLessonPlan(r: LessonPlanRow): LessonPlan {
  let content: PlanContent = {};
  try {
    content = JSON.parse(r.content) as PlanContent;
  } catch {
    // A damaged row still opens, just empty.
  }
  return { ...r, content };
}

const LESSON_PLAN_SELECT =
  "SELECT id, title, grade_level, learning_area, sections, term, week, sessions, minutes, content, updated_at FROM lesson_plans";

export async function listLessonPlans(): Promise<LessonPlan[]> {
  const rows = await (await db()).select<LessonPlanRow[]>(`${LESSON_PLAN_SELECT} ORDER BY updated_at DESC, id DESC`);
  return rows.map(parseLessonPlan);
}

export async function getLessonPlan(id: number): Promise<LessonPlan | null> {
  const [row] = await (await db()).select<LessonPlanRow[]>(`${LESSON_PLAN_SELECT} WHERE id = $1`, [id]);
  return row ? parseLessonPlan(row) : null;
}

export type LessonPlanInput = Omit<LessonPlan, "id" | "updated_at">;

export async function createLessonPlan(p: LessonPlanInput): Promise<number> {
  const res = await (
    await db()
  ).execute(
    `INSERT INTO lesson_plans (title, grade_level, learning_area, sections, term, week, sessions, minutes, content)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      p.title,
      p.grade_level,
      p.learning_area,
      p.sections,
      p.term,
      p.week,
      p.sessions,
      p.minutes,
      JSON.stringify(p.content),
    ],
  );
  return res.lastInsertId as number;
}

export async function updateLessonPlan(id: number, p: LessonPlanInput) {
  await (
    await db()
  ).execute(
    `UPDATE lesson_plans SET title = $1, grade_level = $2, learning_area = $3, sections = $4, term = $5, week = $6,
       sessions = $7, minutes = $8, content = $9, updated_at = datetime('now')
     WHERE id = $10`,
    [
      p.title,
      p.grade_level,
      p.learning_area,
      p.sections,
      p.term,
      p.week,
      p.sessions,
      p.minutes,
      JSON.stringify(p.content),
      id,
    ],
  );
}

export async function deleteLessonPlan(id: number) {
  await (await db()).execute("DELETE FROM lesson_plans WHERE id = $1", [id]);
}

// ---- Quizzes ----

type QuizRow = Omit<Quiz, "content"> & { content: string };

function parseQuiz(r: QuizRow): Quiz {
  let content: Partial<QuizContent> = {};
  try {
    content = JSON.parse(r.content) as QuizContent;
  } catch {
    // A damaged row still opens, just empty.
  }
  return { ...r, content: { ...content, parts: content.parts ?? [] } };
}

const QUIZ_SELECT = "SELECT id, title, lesson_plan_id, grade_level, learning_area, content, updated_at FROM quizzes";

export async function listQuizzes(): Promise<Quiz[]> {
  const rows = await (await db()).select<QuizRow[]>(`${QUIZ_SELECT} ORDER BY updated_at DESC, id DESC`);
  return rows.map(parseQuiz);
}

export async function getQuiz(id: number): Promise<Quiz | null> {
  const [row] = await (await db()).select<QuizRow[]>(`${QUIZ_SELECT} WHERE id = $1`, [id]);
  return row ? parseQuiz(row) : null;
}

export type QuizInput = Omit<Quiz, "id" | "updated_at">;

export async function createQuiz(q: QuizInput): Promise<number> {
  const res = await (
    await db()
  ).execute(
    `INSERT INTO quizzes (title, lesson_plan_id, grade_level, learning_area, content) VALUES ($1, $2, $3, $4, $5)`,
    [q.title, q.lesson_plan_id, q.grade_level, q.learning_area, JSON.stringify(q.content)],
  );
  return res.lastInsertId as number;
}

export async function updateQuiz(id: number, q: QuizInput) {
  await (
    await db()
  ).execute(
    `UPDATE quizzes SET title = $1, lesson_plan_id = $2, grade_level = $3, learning_area = $4, content = $5,
       updated_at = datetime('now')
     WHERE id = $6`,
    [q.title, q.lesson_plan_id, q.grade_level, q.learning_area, JSON.stringify(q.content), id],
  );
}

export async function deleteQuiz(id: number) {
  await (await db()).execute("DELETE FROM quizzes WHERE id = $1", [id]);
}

// ---- Saved groups (Squad Up) ----

/** One group: its learners in order, and its leader if it has one. */
export interface SavedGroup {
  learnerIds: number[];
  leaderId: number | null;
}

export interface SavedGrouping {
  id: number;
  section_id: number;
  name: string;
  groups: SavedGroup[];
  created_at: string;
}

function parseGroups(json: string): SavedGroup[] {
  try {
    const v: unknown = JSON.parse(json);
    if (!Array.isArray(v)) return [];
    return v.map((g) => ({
      learnerIds: Array.isArray(g?.learnerIds) ? g.learnerIds.filter((n: unknown) => typeof n === "number") : [],
      leaderId: typeof g?.leaderId === "number" ? g.leaderId : null,
    }));
  } catch {
    return [];
  }
}

export async function listSavedGroups(sectionId: number): Promise<SavedGrouping[]> {
  const rows = await (
    await db()
  ).select<(Omit<SavedGrouping, "groups"> & { groups: string })[]>(
    "SELECT id, section_id, name, groups, created_at FROM saved_groups WHERE section_id = $1 ORDER BY created_at DESC, id DESC",
    [sectionId],
  );
  return rows.map((r) => ({ ...r, groups: parseGroups(r.groups) }));
}

export async function saveGroups(sectionId: number, name: string, groups: SavedGroup[]): Promise<number> {
  const res = await (
    await db()
  ).execute("INSERT INTO saved_groups (section_id, name, groups) VALUES ($1, $2, $3)", [
    sectionId,
    name.trim(),
    JSON.stringify(groups),
  ]);
  return res.lastInsertId as number;
}

export async function getSavedGroups(id: number): Promise<SavedGrouping | null> {
  const [row] = await (
    await db()
  ).select<(Omit<SavedGrouping, "groups"> & { groups: string })[]>(
    "SELECT id, section_id, name, groups, created_at FROM saved_groups WHERE id = $1",
    [id],
  );
  return row ? { ...row, groups: parseGroups(row.groups) } : null;
}

export async function updateSavedGroups(id: number, name: string, groups: SavedGroup[]) {
  await (
    await db()
  ).execute("UPDATE saved_groups SET name = $1, groups = $2 WHERE id = $3", [name.trim(), JSON.stringify(groups), id]);
}

export async function deleteSavedGroups(id: number) {
  await (await db()).execute("DELETE FROM saved_groups WHERE id = $1", [id]);
}

// ---- Finalized terms ----

/** A class record's finalized terms: term -> when it was finalized. */
export async function listFinalizedTerms(classId: number): Promise<Map<number, string>> {
  const rows = await (
    await db()
  ).select<{ term: number; finalized_at: string }[]>(
    "SELECT term, finalized_at FROM finalized_terms WHERE class_id = $1",
    [classId],
  );
  return new Map(rows.map((r) => [r.term, r.finalized_at]));
}

/** Finalized terms of every class record in a section: class id -> terms. */
export async function listSectionFinalizedTerms(sectionId: number): Promise<Map<number, Set<number>>> {
  const rows = await (
    await db()
  ).select<{ class_id: number; term: number }[]>(
    `SELECT f.class_id, f.term FROM finalized_terms f JOIN classes c ON c.id = f.class_id WHERE c.section_id = $1`,
    [sectionId],
  );
  const out = new Map<number, Set<number>>();
  for (const r of rows) {
    if (!out.has(r.class_id)) out.set(r.class_id, new Set());
    out.get(r.class_id)!.add(r.term);
  }
  return out;
}

export async function finalizeTerm(classId: number, term: number) {
  await (await db()).execute("INSERT OR IGNORE INTO finalized_terms (class_id, term) VALUES ($1, $2)", [classId, term]);
}

export async function unfinalizeTerm(classId: number, term: number) {
  await (await db()).execute("DELETE FROM finalized_terms WHERE class_id = $1 AND term = $2", [classId, term]);
}
