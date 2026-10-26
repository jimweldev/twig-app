import { describe, expect, it } from "vitest";
import {
  computeTerm,
  descriptor,
  orderedAreas,
  finalGrade,
  transmute,
  type ActivityLike,
} from "@/ecr/grading";
import { gradingModeFor, numericSchemeFor, usesTransmutation, type NumericScheme } from "@/ecr/levels";

const CORE: NumericScheme = { weights: { WW: 0.2, PT: 0.5, EX: 0.3 }, exam: "split" };
const SKILLS: NumericScheme = { weights: { WW: 0.2, PT: 0.6, EX: 0.2 }, exam: "split" };

describe("transmute", () => {
  it.each([
    [100, 100],
    [99.5, 100],
    [99.49, 99],
    [98.32, 99],
    [98.31, 98],
    [90.06, 92],
    [88.88, 91],
    [75.9, 80],
    [75.89, 79],
    [74.72, 79],
    [71.18, 76],
    [71.17, 75],
    [70, 75],
    [69.99, 74],
    [65.34, 74],
    [65.33, 73],
    [60.67, 73],
    [60.66, 72],
    [56.01, 72],
    [56, 71],
    [51.34, 71],
    [51.33, 70],
    [46.67, 70],
    [0, 60],
  ])("IG %d -> %d", (ig, tg) => {
    expect(transmute(ig)).toBe(tg);
  });
});

describe("computeTerm", () => {
  const acts: ActivityLike[] = [
    { id: 1, component: "WW", highest_score: 20 },
    { id: 2, component: "WW", highest_score: 30 },
    { id: 3, component: "PT", highest_score: 50 },
    { id: 4, component: "ST1", highest_score: 25 },
    { id: 5, component: "ST2", highest_score: 25 },
    { id: 6, component: "TE", highest_score: 50 },
  ];
  const scores: Record<number, number> = { 1: 18, 2: 24, 3: 40, 4: 20, 5: 15, 6: 40 };

  it("computes core 20/50/30 with ST1/ST2/TE 30/30/40", () => {
    const r = computeTerm(acts, (id) => scores[id], CORE)!;
    expect(r.WW).toEqual({ raw: 42, hps: 50, ps: 84, ws: 16.8 });
    expect(r.PT.ws).toBe(40);
    // EX PS = 80*.3 + 60*.3 + 80*.4 = 74
    expect(r.EX.ps).toBe(74);
    expect(r.EX.ws).toBe(22.2);
    expect(r.initialGrade).toBe(79);
    expect(r.termGrade).toBe(82);
  });

  it("treats blank scores as zero", () => {
    const r = computeTerm(acts, () => undefined, SKILLS)!;
    expect(r.initialGrade).toBe(0);
    expect(r.termGrade).toBe(60);
  });

  it("returns null when nothing has a highest possible score", () => {
    expect(computeTerm([], () => 1, CORE)).toBeNull();
  });
});

describe("finalGrade and descriptor", () => {
  it("averages three term grades and rounds", () => {
    expect(finalGrade([80, 81, 81])).toBe(81);
    expect(finalGrade([80, null, 81])).toBeNull();
  });

  it("maps descriptors", () => {
    expect(descriptor(90)).toBe("Advancing");
    expect(descriptor(89)).toBe("Benchmarking");
    expect(descriptor(75)).toBe("Connecting");
    expect(descriptor(74)).toBe("Developing");
    expect(descriptor(64)).toBe("Emerging");
  });
});

describe("orderedAreas", () => {
  it("uses the report card order by default", () => {
    expect(orderedAreas(7)).toEqual([
      "Filipino",
      "English",
      "Mathematics",
      "Science",
      "Araling Panlipunan",
      "TLE",
      "MAPEH",
      "Values Education",
    ]);
    expect(orderedAreas(5)).toContain("GMRC");
    expect(orderedAreas(5)).toContain("EPP");
  });

  it("applies a saved order, drops areas that don't apply, appends missing ones", () => {
    expect(orderedAreas(7, ["MAPEH", "GMRC", "English", "MAPEH"]).slice(0, 3)).toEqual([
      "MAPEH",
      "English",
      "Filipino",
    ]);
    expect(orderedAreas(7, ["MAPEH"])).toHaveLength(8);
  });
});

describe("exam modes and zero-based grading", () => {
  const acts: ActivityLike[] = [
    { id: 1, component: "WW", highest_score: 10 },
    { id: 2, component: "PT", highest_score: 10 },
    { id: 3, component: "ST1", highest_score: 10 },
    { id: 4, component: "TE", highest_score: 10 },
  ];
  const scores: Record<number, number> = { 1: 8, 2: 9, 3: 2, 4: 10 };

  it("uses only the term exam when exam is te", () => {
    const r = computeTerm(acts, (id) => scores[id], { weights: { WW: 0.15, PT: 0.7, EX: 0.15 }, exam: "te" })!;
    expect(r.EX.ps).toBe(100);
    expect(r.initialGrade).toBe(12 + 63 + 15);
  });

  it("ignores exams when there is no Examinations component", () => {
    const r = computeTerm(acts, (id) => scores[id], { weights: { WW: 0.2, PT: 0.8, EX: 0 }, exam: "none" })!;
    expect(r.initialGrade).toBe(16 + 72);
  });

  it("skips transmutation from SY 2027-2028 with a floor of 60", () => {
    expect(computeTerm(acts, (id) => scores[id], CORE, false)!.termGrade).toBe(Math.round(16 + 45 + 0.3 * (20 * 0.3 + 0 * 0.3 + 100 * 0.4)));
    expect(computeTerm(acts, () => 0, CORE, false)!.termGrade).toBe(60);
    expect(usesTransmutation("2026-2027")).toBe(true);
    expect(usesTransmutation("2027-2028")).toBe(false);
  });
});

describe("levels", () => {
  it("phases Key Stage 1 into descriptive grading", () => {
    expect(gradingModeFor(0, "2026-2027")).toBe("kinder");
    expect(gradingModeFor(1, "2026-2027")).toBe("descriptive");
    expect(gradingModeFor(2, "2026-2027")).toBe("numeric");
    expect(gradingModeFor(2, "2027-2028")).toBe("descriptive");
    expect(gradingModeFor(3, "2027-2028")).toBe("numeric");
    expect(gradingModeFor(3, "2028-2029")).toBe("descriptive");
    expect(gradingModeFor(7, "2028-2029")).toBe("numeric");
  });

  it("picks Senior High weights from the subject type", () => {
    expect(numericSchemeFor({ grade_level: 11, learning_area: "X", subject_type: "sshs-immersion" })).toEqual({
      weights: { WW: 0.2, PT: 0.8, EX: 0 },
      exam: "none",
    });
    expect(numericSchemeFor({ grade_level: 7, learning_area: "MAPEH", subject_type: "" }).weights.PT).toBe(0.6);
  });

  it("averages only the terms a subject runs", () => {
    expect(finalGrade([88, null, null], [1])).toBe(88);
    expect(finalGrade([88, 90, null], [1, 2])).toBe(89);
    expect(finalGrade([88, null, 90], [1, 2])).toBeNull();
  });

  it("orders Senior High subjects that aren't in the standard list", () => {
    expect(orderedAreas(11, ["General Science"], ["Effective Communication", "General Science"])).toEqual([
      "General Science",
      "Effective Communication",
    ]);
  });
});
