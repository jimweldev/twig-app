import { useCallback, useEffect, useState } from "react";
import {
  getSubjectOrder,
  listReceived,
  saveSubjectOrder,
  type ClassRecord,
  type Learner,
  type ReceivedGrade,
  type Section,
} from "@/lib/db";
import { gradingContext, loadClassGrades, withImported, type GradeValue, type LearnerGrades } from "./classGrades";
import { orderedAreas, PASSING_GRADE } from "./grading";
import { gradingModeFor } from "./levels";

export type AreaSource =
  | { area: string; kind: "local"; grades: Map<number, LearnerGrades>; subjectType?: string }
  | { area: string; kind: "received"; info: ReceivedGrade; grades: Map<number, LearnerGrades> }
  | { area: string; kind: "missing"; grades: Map<number, LearnerGrades> };

/**
 * A section's grades in every learning area, in the section's subject order.
 * This computer's class records win over imported grade files; imported grades fill
 * the terms a class record has no grades for.
 */
export function useSectionGrades(
  section: Section,
  learners: Learner[],
  localClasses: ClassRecord[],
  onError: (e: unknown) => void,
) {
  const [areas, setAreas] = useState<AreaSource[]>([]);
  const [loading, setLoading] = useState(true);

  // Reload only when the set of class records or learners changes, not on every new array.
  const classKey = localClasses.map((c) => `${c.id}:${c.learning_area}`).join(",");
  const learnerKey = learners.map((l) => l.id).join(",");

  const reload = useCallback(async () => {
    try {
      const [order, received, local] = await Promise.all([
        getSubjectOrder(section.id),
        listReceived(section.id),
        Promise.all(
          localClasses
            // Kindergarten is one integrated record, not a learning area.
            .filter((c) => gradingModeFor(c.grade_level, c.school_year) !== "kinder")
            .map(async (c) => [c.learning_area, await loadClassGrades(c, learners), c] as const),
        ),
      ]);
      const importedGrades = (info: ReceivedGrade) =>
        new Map(
          received.rows
            .filter((r) => r.received_id === info.id)
            .map((r) => [r.learner_id, { terms: [r.term1, r.term2, r.term3], final: r.final }]),
        );
      const localByArea = new Map(local.map(([area, grades, c]) => [area, { grades, c }]));
      // Senior High subjects aren't in the standard list; include whatever the section has.
      const present = [...local.map(([area]) => area), ...received.grades.map((g) => g.learning_area)];
      setAreas(
        orderedAreas(section.grade_level, order, present).map((area): AreaSource => {
          const mine = localByArea.get(area);
          const info = received.grades.find((r) => r.learning_area === area);
          if (mine) {
            const grades = info ? withImported(mine.grades, importedGrades(info), gradingContext(mine.c)) : mine.grades;
            return { area, kind: "local", grades, subjectType: mine.c.subject_type };
          }
          if (!info) return { area, kind: "missing", grades: new Map() };
          return { area, kind: "received", info, grades: importedGrades(info) };
        }),
      );
    } catch (e) {
      onError(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id, section.grade_level, classKey, learnerKey, onError]);

  useEffect(() => {
    reload();
  }, [reload]);

  /**
   * Saves a new subject order and applies it right away. `order` may list only
   * some areas (e.g. the subjects the section has); the rest keep their place after them.
   */
  const setOrder = async (order: string[]) => {
    const full = [...order, ...areas.map((a) => a.area).filter((a) => !order.includes(a))];
    setAreas((prev) => full.map((a) => prev.find((x) => x.area === a)!).filter(Boolean));
    try {
      await saveSubjectOrder(section.id, full);
    } catch (e) {
      onError(e);
      reload();
    }
  };

  return { areas, loading, reload, setOrder };
}

/** Grade of a learner in one area: a term (0-2) or "final". */
export function gradeIn(source: AreaSource, learnerId: number, period: 0 | 1 | 2 | "final"): GradeValue {
  const g = source.grades.get(learnerId);
  if (!g) return null;
  return period === "final" ? g.final : (g.terms[period] ?? null);
}

/** General average: mean of all final grades, only when every area has a numeric one. */
export function generalAverage(areas: AreaSource[], learnerId: number): number | null {
  return averageIn(areas, learnerId, "final");
}

/**
 * Mean grade for a term (0-2) or the final, rounded like the report card. Every area
 * needs a numeric grade unless `skipEmpty` (a Senior High subject may not run every term).
 */
export function averageIn(
  areas: AreaSource[],
  learnerId: number,
  period: 0 | 1 | 2 | "final",
  skipEmpty = false,
): number | null {
  const all = areas.map((a) => gradeIn(a, learnerId, period));
  const grades = skipEmpty ? all.filter((g) => typeof g === "number") : all;
  if (grades.length === 0 || grades.some((g) => typeof g !== "number")) return null;
  return Math.round((grades as number[]).reduce((a, b) => a + b, 0) / grades.length);
}

export const isPassing = (g: GradeValue) => typeof g === "number" && g >= PASSING_GRADE;
export const isFailing = (g: GradeValue) => typeof g === "number" && g < PASSING_GRADE;
