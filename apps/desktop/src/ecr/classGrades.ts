import {
  listActivities,
  listDescriptive,
  listScores,
  scoreKey,
  type Activity,
  type ClassRecord,
  type Learner,
} from "@/lib/db";
import { computeTerm, finalGrade, TERMS, type Term } from "@/ecr/grading";
import {
  gradingModeFor,
  numericSchemeFor,
  parseTerms,
  usesTransmutation,
  type GradingMode,
  type NumericScheme,
} from "./levels";

/** A grade: a number (numeric grading) or a code such as "A" (descriptive grading). */
export type GradeValue = number | string | null;

export interface LearnerGrades {
  terms: GradeValue[];
  final: GradeValue;
}

/** Everything that decides how one class record is graded. */
export interface GradingContext {
  mode: GradingMode;
  scheme: NumericScheme;
  /** Adjusted transmutation table (SY 2026-2027) vs zero-based grading. */
  transmuted: boolean;
  /** Terms the subject runs. */
  terms: Term[];
}

export function gradingContext(c: ClassRecord): GradingContext {
  const terms = parseTerms(c.terms);
  return {
    mode: gradingModeFor(c.grade_level, c.school_year),
    scheme: numericSchemeFor(c),
    transmuted: usesTransmutation(c.school_year),
    terms: terms.length ? terms : TERMS,
  };
}

/** Term and final grades of every learner in one numerically graded class record. */
export function classGrades(
  learners: Learner[],
  activities: Activity[],
  scores: Map<string, number>,
  ctx: GradingContext,
): Map<number, LearnerGrades> {
  const byTerm = TERMS.map((t) => (ctx.terms.includes(t) ? activities.filter((a) => a.term === t) : []));
  return new Map(
    learners.map((l) => {
      const terms = byTerm.map(
        (acts) =>
          computeTerm(acts, (id) => scores.get(scoreKey(id, l.id)), ctx.scheme, ctx.transmuted)?.termGrade ?? null,
      );
      return [l.id, { terms, final: finalGrade(terms, ctx.terms) }];
    }),
  );
}

/**
 * Loads a class record's grades whatever its grading: computed from scores
 * (numeric) or the teacher's descriptive ratings (term 4 = final).
 * Kindergarten has no per-subject grades and returns an empty map.
 */
export async function loadClassGrades(c: ClassRecord, learners: Learner[]): Promise<Map<number, LearnerGrades>> {
  const ctx = gradingContext(c);
  if (ctx.mode === "kinder") return new Map();
  if (ctx.mode === "descriptive") {
    const ratings = (await listDescriptive(c.id)).filter((r) => r.item === "");
    const codeOf = (learnerId: number, term: number) =>
      ratings.find((r) => r.learner_id === learnerId && r.term === term)?.code ?? null;
    return new Map(learners.map((l) => [l.id, { terms: TERMS.map((t) => codeOf(l.id, t)), final: codeOf(l.id, 4) }]));
  }
  const [acts, scores] = await Promise.all([listActivities(c.id), listScores(c.id)]);
  const scoreMap = new Map(scores.map((s) => [scoreKey(s.activity_id, s.learner_id), s.score]));
  return classGrades(learners, acts, scoreMap, ctx);
}
