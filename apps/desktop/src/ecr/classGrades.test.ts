import { describe, expect, it } from "vitest";
import { scoreKey, type Activity, type Learner } from "@/lib/db";
import {
  classPartGrades,
  importedPartGrades,
  partTermGrades,
  termGrade,
  withImported,
  type LearnerGrades,
} from "./classGrades";
import { partsOf } from "./levels";

const g = (terms: LearnerGrades["terms"], final: LearnerGrades["final"] = null): LearnerGrades => ({ terms, final });

describe("withImported", () => {
  const ctx = { mode: "numeric" as const, terms: [1, 2, 3] as (1 | 2 | 3)[] };

  it("replaces the teacher's own term grades with imported ones and keeps the rest", () => {
    const own = new Map([[1, g([90, 85, null])]]);
    const imported = new Map([[1, g([null, 80, 87])]]);
    expect(withImported(own, imported, ctx).get(1)).toEqual(g([90, 80, 87], 86));
  });

  it("leaves the final blank until every term has a grade", () => {
    const merged = withImported(new Map([[1, g([null, null, null])]]), new Map([[1, g([88, null, null])]]), ctx);
    expect(merged.get(1)).toEqual(g([88, null, null], null));
  });

  it("uses imported descriptive ratings over the teacher's own", () => {
    const merged = withImported(new Map([[1, g(["C", "C", null], "C")]]), new Map([[1, g(["A", null, "A"], "A")]]), {
      ...ctx,
      mode: "descriptive",
    });
    expect(merged.get(1)).toEqual(g(["A", "C", "A"], "A"));
  });
});

describe("termGrade with parts (MAPEH)", () => {
  const ctx = {
    // Performance tasks only, so a part's term grade is its PT percentage.
    scheme: { weights: { WW: 0, PT: 1, EX: 0 }, exam: "none" as const },
    transmuted: false,
    parts: partsOf("MAPEH"),
  };
  const acts = [
    { id: 1, component: "PT" as const, highest_score: 10, part: "MA" },
    { id: 2, component: "PT" as const, highest_score: 10, part: "PEH" },
  ];

  it("averages the Music and Arts and PE and Health term grades", () => {
    const scores: Record<number, number> = { 1: 9, 2: 7.5 };
    expect(partTermGrades(acts, (id) => scores[id], ctx)).toEqual([90, 75]);
    expect(termGrade(acts, (id) => scores[id], ctx)).toBe(83);
  });

  it("uses a part grade imported from another teacher in place of that part's scores", () => {
    const imports = new Map([["PEH", new Map([[7, g([null, 85, null])]])]]);
    const override = importedPartGrades(imports, ctx, 7, 2);
    expect(override).toEqual([null, 85]);
    expect(termGrade(acts.slice(0, 1), () => 9, ctx, override)).toBe(88);
  });

  it("waits until both parts have something scored", () => {
    expect(termGrade(acts.slice(0, 1), () => 10, ctx)).toBeNull();
  });

  it("grades other learning areas from all their activities", () => {
    expect(termGrade(acts, (id) => (id === 1 ? 9 : 7), { ...ctx, parts: partsOf("Science") })).toBe(80);
  });
});

describe("classPartGrades", () => {
  it("gives each MAPEH part its own term and final grades", () => {
    const learner = { id: 1 } as Learner;
    const acts = [1, 2, 3].flatMap((term) => [
      { id: term * 10 + 1, class_id: 1, term, component: "PT", position: 1, highest_score: 10, part: "MA" },
      { id: term * 10 + 2, class_id: 1, term, component: "PT", position: 1, highest_score: 10, part: "PEH" },
    ]) as Activity[];
    const scores = new Map(acts.map((a) => [scoreKey(a.id, 1), a.part === "MA" ? 9 : 8]));
    const ctx = {
      mode: "numeric" as const,
      scheme: { weights: { WW: 0, PT: 1, EX: 0 }, exam: "none" as const },
      transmuted: false,
      terms: [1, 2, 3] as (1 | 2 | 3)[],
      parts: partsOf("MAPEH"),
    };
    const [ma, peh] = classPartGrades([learner], acts, scores, ctx);
    expect(ma.grades.get(1)).toEqual(g([90, 90, 90], 90));
    expect(peh.grades.get(1)).toEqual(g([80, 80, 80], 80));
  });
});
