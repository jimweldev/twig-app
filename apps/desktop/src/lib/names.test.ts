import { describe, expect, it } from "vitest";
import { ageOn, currentSchoolYear, isValidSchoolYear, normalizeDate, parseLearnerLine, suggestSchoolYear } from "@/lib/names";

describe("school years", () => {
  it("validates consecutive years", () => {
    expect(isValidSchoolYear("2026-2027")).toBe(true);
    expect(isValidSchoolYear("2026-2028")).toBe(false);
    expect(isValidSchoolYear("2026")).toBe(false);
  });

  it("uses June as the start of a school year", () => {
    expect(currentSchoolYear(new Date(2026, 5, 1))).toBe("2026-2027");
    expect(currentSchoolYear(new Date(2027, 2, 1))).toBe("2026-2027");
  });

  it("suggests the year after the latest", () => {
    expect(suggestSchoolYear(["2025-2026", "2026-2027"])).toBe("2027-2028");
  });
});

describe("parseLearnerLine", () => {
  it("parses comma and tab formats", () => {
    expect(parseLearnerLine("DELA CRUZ, Juan, Mendoza", "M")).toMatchObject({
      last_name: "DELA CRUZ",
      first_name: "Juan",
      middle_name: "Mendoza",
    });
    expect(parseLearnerLine("123456789012\tSANTOS\tMaria\tReyes", "F")).toMatchObject({
      lrn: "123456789012",
      last_name: "SANTOS",
      sex: "F",
    });
    expect(parseLearnerLine("OnlyOneName", "M")).toBeNull();
  });
});

describe("birthdates", () => {
  it("normalizes ISO and month-first dates", () => {
    expect(normalizeDate("2014-03-09")).toBe("2014-03-09");
    expect(normalizeDate("3/9/2014")).toBe("2014-03-09");
    expect(normalizeDate("2/30/2014")).toBe("");
    expect(normalizeDate("Mendoza")).toBe("");
  });

  it("computes age in whole years", () => {
    expect(ageOn("2014-03-09", "2026-10-26")).toBe(12);
    expect(ageOn("2014-11-02", "2026-10-26")).toBe(11);
    expect(ageOn("2014-10-26", "2026-10-26")).toBe(12);
    expect(ageOn("", "2026-10-26")).toBeNull();
  });

  it("reads a trailing birthdate from pasted Excel cells", () => {
    expect(parseLearnerLine("123456789012\tSANTOS\tMaria\tReyes\t3/9/2014", "F")).toMatchObject({
      middle_name: "Reyes",
      birthdate: "2014-03-09",
    });
  });
});
