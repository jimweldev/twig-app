// Grade levels K-12 under DO 015, s. 2026 (as reported by secondary sources;
// verify against the official issuance). Which grading applies depends on the
// grade level, the school year (KS1 phases into descriptive grading), and for
// Senior High the subject type.

import type { Term, Weights } from "./grading";

export const GRADE_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const gradeLabel = (grade: number) => (grade === 0 ? "Kindergarten" : `Grade ${grade}`);
export const isSeniorHigh = (grade: number) => grade >= 11;

const syStart = (schoolYear: string) => Number(schoolYear.slice(0, 4));

/** numeric: WW/PT/Exam scores; descriptive: A-E per term (Grades 1-3); kinder: CO/DV/BG per domain. */
export type GradingMode = "numeric" | "descriptive" | "kinder";

export function gradingModeFor(grade: number, schoolYear: string): GradingMode {
  if (grade === 0) return "kinder";
  // KS1 moves to descriptive grading one grade per year: Grade 1 in SY 2026-2027,
  // Grade 2 in 2027-2028, Grade 3 in 2028-2029.
  if (grade <= 3 && syStart(schoolYear) >= 2025 + grade) return "descriptive";
  return "numeric";
}

/** The adjusted transmutation table applies in SY 2026-2027 only; zero-based grading after. */
export const usesTransmutation = (schoolYear: string) => syStart(schoolYear) <= 2026;

/** split: ST1 30% + ST2 30% + Term Exam 40%; te: Term Exam only; none: no Examinations component. */
export type ExamMode = "split" | "te" | "none";

export interface NumericScheme {
  weights: Weights;
  exam: ExamMode;
}

// ---- Grades 1-10: learning areas ----

const CORE: Weights = { WW: 0.2, PT: 0.5, EX: 0.3 };
const SKILLS: Weights = { WW: 0.2, PT: 0.6, EX: 0.2 };

export interface LearningArea {
  name: string;
  weights: Weights;
  grades: number[];
}

export const LEARNING_AREAS: LearningArea[] = [
  // Key Stage 1 (MATATAG). Grades 2-3 use 20/50/30 while still numerically graded.
  { name: "Language", weights: CORE, grades: [1] },
  { name: "Reading and Literacy", weights: CORE, grades: [1] },
  { name: "Makabansa", weights: CORE, grades: [1, 2, 3] },
  // Key Stages 1-3
  { name: "Filipino", weights: CORE, grades: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { name: "English", weights: CORE, grades: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { name: "Mathematics", weights: CORE, grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { name: "Science", weights: CORE, grades: [3, 4, 5, 6, 7, 8, 9, 10] },
  { name: "Araling Panlipunan", weights: CORE, grades: [4, 5, 6, 7, 8, 9, 10] },
  { name: "GMRC", weights: CORE, grades: [1, 2, 3, 4, 5, 6] },
  { name: "Values Education", weights: CORE, grades: [7, 8, 9, 10] },
  { name: "EPP", weights: SKILLS, grades: [4, 5, 6] },
  { name: "TLE", weights: SKILLS, grades: [7, 8, 9, 10] },
  { name: "MAPEH", weights: SKILLS, grades: [4, 5, 6, 7, 8, 9, 10] },
];

export const areasForGrade = (grade: number) => LEARNING_AREAS.filter((a) => a.grades.includes(grade));

// ---- Senior High: subject types ----

export interface SubjectType {
  id: string;
  label: string;
  /** Report card grouping. */
  category: "Core" | "Applied and Specialized";
  weights: Weights;
  exam: ExamMode;
  grades: number[];
}

export const SUBJECT_TYPES: SubjectType[] = [
  // Strengthened SHS curriculum (Grade 11 from SY 2026-2027; Grade 12 in pilot schools)
  { id: "sshs-core", label: "Core subject", category: "Core", weights: CORE, exam: "split", grades: [11, 12] },
  { id: "sshs-academic", label: "Academic elective", category: "Applied and Specialized", weights: CORE, exam: "split", grades: [11, 12] },
  {
    id: "sshs-field",
    label: "Field Exposure / Arts Apprenticeship / Creative Production and Innovation",
    category: "Applied and Specialized",
    weights: { WW: 0.15, PT: 0.7, EX: 0.15 },
    exam: "te",
    grades: [11, 12],
  },
  { id: "sshs-asw", label: "Arts, Sports, Health and Wellness elective", category: "Applied and Specialized", weights: SKILLS, exam: "split", grades: [11, 12] },
  {
    id: "sshs-research",
    label: "Research elective / Design and Innovation",
    category: "Applied and Specialized",
    weights: { WW: 0.4, PT: 0.6, EX: 0 },
    exam: "none",
    grades: [11, 12],
  },
  {
    id: "sshs-techpro",
    label: "TechPro elective",
    category: "Applied and Specialized",
    weights: { WW: 0.15, PT: 0.65, EX: 0.2 },
    exam: "split",
    grades: [11, 12],
  },
  {
    id: "sshs-immersion",
    label: "Work Immersion",
    category: "Applied and Specialized",
    weights: { WW: 0.2, PT: 0.8, EX: 0 },
    exam: "none",
    grades: [11, 12],
  },
  // Grade 12 not yet on the strengthened curriculum: DO 8, s. 2015 weights
  // with the adjusted transmutation table.
  { id: "do8-core", label: "Core subject (old curriculum)", category: "Core", weights: { WW: 0.25, PT: 0.5, EX: 0.25 }, exam: "split", grades: [12] },
  {
    id: "do8-academic",
    label: "Academic track subject (old curriculum)",
    category: "Applied and Specialized",
    weights: { WW: 0.25, PT: 0.45, EX: 0.3 },
    exam: "split",
    grades: [12],
  },
  {
    id: "do8-academic-wi",
    label: "Academic track: Work Immersion / Research / Business Enterprise / Exhibit / Performance (old curriculum)",
    category: "Applied and Specialized",
    weights: { WW: 0.35, PT: 0.4, EX: 0.25 },
    exam: "split",
    grades: [12],
  },
  {
    id: "do8-tvl",
    label: "TVL / Sports / Arts and Design track subject (old curriculum)",
    category: "Applied and Specialized",
    weights: SKILLS,
    exam: "split",
    grades: [12],
  },
];

export const subjectTypesForGrade = (grade: number) => SUBJECT_TYPES.filter((t) => t.grades.includes(grade));
export const subjectTypeOf = (id: string) => SUBJECT_TYPES.find((t) => t.id === id);

/** Grade 11 core subjects of the strengthened curriculum, offered as suggestions. */
export const SHS_CORE_SUBJECTS = [
  "Effective Communication",
  "Life and Career Skills",
  "General Mathematics",
  "General Science",
  "Pag-aaral ng Kasaysayan at Lipunang Pilipino",
];

/** Weights and exam structure of one class record. */
export function numericSchemeFor(c: { grade_level: number; learning_area: string; subject_type: string }): NumericScheme {
  if (isSeniorHigh(c.grade_level)) {
    const t = subjectTypeOf(c.subject_type) ?? SUBJECT_TYPES[0];
    return { weights: t.weights, exam: t.exam };
  }
  return { weights: LEARNING_AREAS.find((a) => a.name === c.learning_area)?.weights ?? CORE, exam: "split" };
}

/** Terms a class record runs, from its stored "1,2,3" list. */
export const parseTerms = (terms: string): Term[] =>
  terms
    .split(",")
    .map(Number)
    .filter((t): t is Term => t === 1 || t === 2 || t === 3);

// ---- Descriptive grading ----

/** Grades 1-3 (descriptive), per learning area per term. */
export const DESCRIPTIVE_CODES = [
  { code: "A", name: "Advancing" },
  { code: "B", name: "Benchmarking" },
  { code: "C", name: "Connecting" },
  { code: "D", name: "Developing" },
  { code: "E", name: "Emerging" },
] as const;

/** Kindergarten, per developmental domain per term. */
export const KINDER_CODES = [
  { code: "CO", name: "Consistent" },
  { code: "DV", name: "Developing" },
  { code: "BG", name: "Beginning" },
] as const;

/** Kindergarten is assessed as one integrated record across developmental domains. */
export const KINDER_RECORD = "Kindergarten";

export const KINDER_DOMAINS = [
  { key: "socio-emotional", name: "Socio-Emotional Development" },
  { key: "values", name: "Values Development" },
  { key: "physical-health-motor", name: "Physical Health and Motor Development" },
  { key: "aesthetic-creative", name: "Aesthetic / Creative Development" },
  { key: "mathematics", name: "Mathematics" },
  { key: "physical-natural-environment", name: "Understanding of the Physical and Natural Environment" },
  { key: "language-literacy", name: "Language, Literacy and Communication" },
];
