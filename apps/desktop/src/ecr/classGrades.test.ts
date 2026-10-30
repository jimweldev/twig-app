import { describe, expect, it } from "vitest";
import { withImported, type LearnerGrades } from "./classGrades";

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
