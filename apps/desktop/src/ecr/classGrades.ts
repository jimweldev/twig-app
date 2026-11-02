import {
  listActivities,
  listDescriptive,
  listReceived,
  listScores,
  scoreKey,
  type Activity,
  type ClassRecord,
  type Learner,
  type ReceivedGrade,
  type ReceivedRow,
} from "@/lib/db";
import { computeTerm, finalGrade, TERMS, type ActivityLike, type ScoreOf, type Term } from "@/ecr/grading";
import {
  gradingModeFor,
  numericSchemeFor,
  parseTerms,
  partArea,
  partsOf,
  usesTransmutation,
  type AreaPart,
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
  /** Parts scored on their own sheets (MAPEH); none for most. */
  parts: AreaPart[];
}

export function gradingContext(c: ClassRecord): GradingContext {
  const terms = parseTerms(c.terms);
  return {
    mode: gradingModeFor(c.grade_level, c.school_year),
    scheme: numericSchemeFor(c),
    transmuted: usesTransmutation(c.school_year),
    terms: terms.length ? terms : TERMS,
    parts: partsOf(c.learning_area),
  };
}

/** Imported term grades for one learning area (or one part of it): the import and each learner's grades. */
export function receivedFor(
  received: { grades: ReceivedGrade[]; rows: ReceivedRow[] },
  area: string,
): { info: ReceivedGrade | null; grades: Map<number, LearnerGrades> } {
  const info = received.grades.find((g) => g.learning_area === area) ?? null;
  return {
    info,
    grades: new Map(
      received.rows
        .filter((row) => row.received_id === info?.id)
        .map((row) => [row.learner_id, { terms: [row.term1, row.term2, row.term3], final: row.final }]),
    ),
  };
}

/** Part id → imported grades for that part (MAPEH: a Music and Arts or PE and Health teacher's term grades). */
export type PartImports = Map<string, Map<number, LearnerGrades>>;

/** One learner's imported term grade for each part, in the order of ctx.parts. */
export function importedPartGrades(
  imports: PartImports | undefined,
  ctx: Pick<GradingContext, "parts">,
  learnerId: number,
  term: Term,
): (number | null)[] {
  return ctx.parts.map((p) => {
    const g = imports?.get(p.id)?.get(learnerId)?.terms[term - 1];
    return typeof g === "number" ? g : null;
  });
}

/**
 * Each part's term grade, in the order of ctx.parts; null where a part has nothing scored yet.
 * An imported part grade (override) replaces the one from scores.
 */
export function partTermGrades(
  activities: (ActivityLike & { part: string })[],
  scoreOf: ScoreOf,
  ctx: Pick<GradingContext, "scheme" | "transmuted" | "parts">,
  override: (number | null)[] = [],
): (number | null)[] {
  return ctx.parts.map(
    (p, i) =>
      override[i] ??
      computeTerm(
        activities.filter((a) => a.part === p.id),
        scoreOf,
        ctx.scheme,
        ctx.transmuted,
      )?.termGrade ??
      null,
  );
}

/**
 * One learner's term grade from one term's activities. With parts (MAPEH) it is
 * the average of the parts' term grades, rounded, once every part has one.
 */
export function termGrade(
  activities: (ActivityLike & { part: string })[],
  scoreOf: ScoreOf,
  ctx: Pick<GradingContext, "scheme" | "transmuted" | "parts">,
  override: (number | null)[] = [],
): number | null {
  if (ctx.parts.length === 0) return computeTerm(activities, scoreOf, ctx.scheme, ctx.transmuted)?.termGrade ?? null;
  const grades = partTermGrades(activities, scoreOf, ctx, override);
  if (grades.some((g) => g === null)) return null;
  return Math.round((grades as number[]).reduce((a, b) => a + b, 0) / grades.length);
}

/** Term and final grades of every learner in one numerically graded class record. */
export function classGrades(
  learners: Learner[],
  activities: Activity[],
  scores: Map<string, number>,
  ctx: GradingContext,
  partImports?: PartImports,
): Map<number, LearnerGrades> {
  const byTerm = TERMS.map((t) => (ctx.terms.includes(t) ? activities.filter((a) => a.term === t) : []));
  return new Map(
    learners.map((l) => {
      const terms = byTerm.map((acts, i) =>
        termGrade(
          acts,
          (id) => scores.get(scoreKey(id, l.id)),
          ctx,
          importedPartGrades(partImports, ctx, l.id, TERMS[i]),
        ),
      );
      return [l.id, { terms, final: finalGrade(terms, ctx.terms) }];
    }),
  );
}

/** One part's term and final grades (MAPEH: Music and Arts, PE and Health), by learner. */
export interface PartGrades {
  part: AreaPart;
  grades: Map<number, LearnerGrades>;
}

/** Each part's term and final grades in a class record scored in parts; imported part grades included. */
export function classPartGrades(
  learners: Learner[],
  activities: Activity[],
  scores: Map<string, number>,
  ctx: GradingContext,
  partImports?: PartImports,
): PartGrades[] {
  const byTerm = TERMS.map((t) => (ctx.terms.includes(t) ? activities.filter((a) => a.term === t) : []));
  const perLearner = new Map(
    learners.map((l) => [
      l.id,
      byTerm.map((acts, i) =>
        partTermGrades(
          acts,
          (id) => scores.get(scoreKey(id, l.id)),
          ctx,
          importedPartGrades(partImports, ctx, l.id, TERMS[i]),
        ),
      ),
    ]),
  );
  return ctx.parts.map((part, p) => ({
    part,
    grades: new Map(
      learners.map((l) => {
        const terms = perLearner.get(l.id)!.map((byPart) => byPart[p]);
        return [l.id, { terms, final: finalGrade(terms, ctx.terms) }];
      }),
    ),
  }));
}

/**
 * Loads a class record's grades whatever its grading: computed from scores
 * (numeric) or the teacher's descriptive ratings (term 4 = final).
 * Kindergarten has no per-subject grades and returns an empty map.
 * A record scored in parts (MAPEH) also returns each part's grades.
 */
export async function loadClassGrades(
  c: ClassRecord,
  learners: Learner[],
): Promise<{ grades: Map<number, LearnerGrades>; parts: PartGrades[] }> {
  const ctx = gradingContext(c);
  if (ctx.mode === "kinder") return { grades: new Map(), parts: [] };
  if (ctx.mode === "descriptive") {
    const ratings = (await listDescriptive(c.id)).filter((r) => r.item === "");
    const codeOf = (learnerId: number, term: number) =>
      ratings.find((r) => r.learner_id === learnerId && r.term === term)?.code ?? null;
    return {
      grades: new Map(
        learners.map((l) => [l.id, { terms: TERMS.map((t) => codeOf(l.id, t)), final: codeOf(l.id, 4) }]),
      ),
      parts: [],
    };
  }
  const [acts, scores, received] = await Promise.all([
    listActivities(c.id),
    listScores(c.id),
    ctx.parts.length ? listReceived(c.section_id) : null,
  ]);
  const scoreMap = new Map(scores.map((s) => [scoreKey(s.activity_id, s.learner_id), s.score]));
  const partImports: PartImports | undefined = received
    ? new Map(ctx.parts.map((p) => [p.id, receivedFor(received, partArea(c.learning_area, p.id)).grades]))
    : undefined;
  return {
    grades: classGrades(learners, acts, scoreMap, ctx, partImports),
    parts: classPartGrades(learners, acts, scoreMap, ctx, partImports),
  };
}

/**
 * A class record's grades with imported grades on top: an imported term grade
 * replaces the teacher's own for that term, and the teacher's own grades fill the
 * other terms. Numeric finals are recomputed from the merged terms.
 */
export function withImported(
  own: Map<number, LearnerGrades>,
  imported: Map<number, LearnerGrades>,
  ctx: Pick<GradingContext, "mode" | "terms">,
): Map<number, LearnerGrades> {
  if (imported.size === 0) return own;
  const ids = new Set([...own.keys(), ...imported.keys()]);
  return new Map(
    [...ids].map((id) => {
      const mine = own.get(id);
      const theirs = imported.get(id);
      const terms = TERMS.map((t) => theirs?.terms[t - 1] ?? mine?.terms[t - 1] ?? null);
      const final =
        ctx.mode === "numeric"
          ? finalGrade(
              terms.map((g) => (typeof g === "number" ? g : null)),
              ctx.terms,
            )
          : (theirs?.final ?? mine?.final ?? null);
      return [id, { terms, final }];
    }),
  );
}
