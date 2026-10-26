// Numeric grading math from DepEd Order No. 015, s. 2026 (Policy Guidelines on
// Classroom Assessment). Which weights and rules apply per grade level and
// subject lives in levels.ts.

import { LEARNING_AREAS, type NumericScheme } from "./levels";

export type Component = "WW" | "PT" | "ST1" | "ST2" | "TE";
export type Term = 1 | 2 | 3;
export const TERMS: Term[] = [1, 2, 3];

export interface Weights {
  WW: number;
  PT: number;
  EX: number;
}

// Internal split of the Examination component.
export const EXAM_SPLIT = { ST1: 0.3, ST2: 0.3, TE: 0.4 } as const;

export interface ActivityLike {
  id: number;
  component: Component;
  highest_score: number;
}

/** Score lookup for one learner; undefined means blank (counted as 0). */
export type ScoreOf = (activityId: number) => number | undefined;

export interface ComponentResult {
  raw: number;
  hps: number;
  ps: number;
  ws: number;
}

export interface ExamResult {
  ST1: number;
  ST2: number;
  TE: number;
  ps: number;
  ws: number;
}

export interface TermResult {
  WW: ComponentResult;
  PT: ComponentResult;
  EX: ExamResult;
  initialGrade: number;
  termGrade: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function percentScore(activities: ActivityLike[], scoreOf: ScoreOf) {
  let raw = 0;
  let hps = 0;
  for (const a of activities) {
    raw += scoreOf(a.id) ?? 0;
    hps += a.highest_score;
  }
  return { raw, hps, ps: hps > 0 ? round2((raw / hps) * 100) : 0 };
}

/**
 * Term grade for one learner. Returns null when the term has no
 * activities with a highest possible score yet.
 */
export function computeTerm(
  activities: ActivityLike[],
  scoreOf: ScoreOf,
  scheme: NumericScheme,
  /** Adjusted transmutation table (SY 2026-2027); otherwise zero-based with a floor of 60. */
  transmuted = true,
): TermResult | null {
  const { weights, exam } = scheme;
  const scored = activities.filter((a) => a.highest_score > 0);
  if (scored.length === 0) return null;
  const of = (c: Component) => scored.filter((a) => a.component === c);

  const ww = percentScore(of("WW"), scoreOf);
  const pt = percentScore(of("PT"), scoreOf);
  const st1 = percentScore(of("ST1"), scoreOf).ps;
  const st2 = percentScore(of("ST2"), scoreOf).ps;
  const te = percentScore(of("TE"), scoreOf).ps;
  const exPs =
    exam === "none"
      ? 0
      : exam === "te"
        ? te
        : round2(st1 * EXAM_SPLIT.ST1 + st2 * EXAM_SPLIT.ST2 + te * EXAM_SPLIT.TE);

  const WW = { ...ww, ws: round2(ww.ps * weights.WW) };
  const PT = { ...pt, ws: round2(pt.ps * weights.PT) };
  const EX = { ST1: st1, ST2: st2, TE: te, ps: exPs, ws: round2(exPs * weights.EX) };
  const initialGrade = round2(WW.ws + PT.ws + EX.ws);

  const termGrade = transmuted ? transmute(initialGrade) : Math.max(60, Math.round(initialGrade));
  return { WW, PT, EX, initialGrade, termGrade };
}

/**
 * Adjusted transmutation table (SY 2026-2027).
 * IG 70.00 -> 75; above 70 each grade spans 1.18 points, 99.50+ -> 100.
 * Below 70, grades 60-74 split 0-70 into 15 bands of 70/15 points.
 */
export function transmute(initialGrade: number): number {
  const ig = Math.round(initialGrade * 100); // hundredths, avoids float drift
  if (ig >= 9950) return 100;
  if (ig >= 7000) return Math.min(99, 75 + Math.floor((ig - 7000) / 118));
  let k = 0;
  for (let j = 1; j <= 14; j++) if (ig * 3 > j * 1400) k = j;
  return 60 + k;
}

/**
 * Final grade: average of the term grades of the terms the subject runs
 * (all three unless a Senior High subject runs fewer), rounded.
 */
export function finalGrade(termGrades: (number | null)[], terms: Term[] = TERMS): number | null {
  const offered = terms.map((t) => termGrades[t - 1] ?? null);
  if (offered.length === 0 || offered.some((g) => g === null)) return null;
  return Math.round((offered as number[]).reduce((a, b) => a + b, 0) / offered.length);
}

export type Descriptor =
  | "Advancing"
  | "Benchmarking"
  | "Connecting"
  | "Developing"
  | "Emerging";

export function descriptor(grade: number): Descriptor {
  if (grade >= 90) return "Advancing";
  if (grade >= 80) return "Benchmarking";
  if (grade >= 75) return "Connecting";
  if (grade >= 65) return "Developing";
  return "Emerging";
}

/** DO 015, s. 2026 descriptors, highest first. */
export const DESCRIPTOR_SCALE: { name: Descriptor; range: string; passed: boolean }[] = [
  { name: "Advancing", range: "90–100", passed: true },
  { name: "Benchmarking", range: "80–89", passed: true },
  { name: "Connecting", range: "75–79", passed: true },
  { name: "Developing", range: "65–74", passed: false },
  { name: "Emerging", range: "Below 65", passed: false },
];

export const PASSING_GRADE = 75;

/** Usual order of learning areas on the SF9 report card; teachers can reorder per section. */
export const REPORT_CARD_ORDER = [
  "Language",
  "Reading and Literacy",
  "Filipino",
  "English",
  "Mathematics",
  "Science",
  "Araling Panlipunan",
  "Makabansa",
  "EPP",
  "TLE",
  "MAPEH",
  "GMRC",
  "Values Education",
];

/**
 * Learning areas for a grade in display order: the section's saved order
 * first (ignoring areas that don't apply), then any others in the default order.
 * `present` adds subjects outside the standard list (Senior High subjects).
 */
export function orderedAreas(grade: number, saved: string[] = [], present: string[] = []): string[] {
  const standard = LEARNING_AREAS.filter((a) => a.grades.includes(grade)).map((a) => a.name);
  const applicable = [...standard, ...present.filter((a) => !standard.includes(a))];
  const defaults = [...REPORT_CARD_ORDER.filter((a) => applicable.includes(a)), ...applicable.filter((a) => !REPORT_CARD_ORDER.includes(a))];
  const kept = saved.filter((a, i) => applicable.includes(a) && saved.indexOf(a) === i);
  return [...kept, ...defaults.filter((a) => !kept.includes(a))];
}
