import { describe, expect, it } from "vitest";
import {
  applyKind,
  defaultField,
  fieldText,
  fitSizePct,
  formatDate,
  formatName,
  honorBand,
  nextFieldId,
  parseFields,
  SAMPLE_CONTEXT,
} from "./fields";

const juan = { first_name: "Juan Miguel", middle_name: "pascual", last_name: "Dela Cruz", average: 96 };

describe("formatName", () => {
  it("formats every name order", () => {
    expect(formatName(juan, "first_mi_last")).toBe("Juan Miguel P. Dela Cruz");
    expect(formatName(juan, "first_middle_last")).toBe("Juan Miguel pascual Dela Cruz");
    expect(formatName(juan, "first_last")).toBe("Juan Miguel Dela Cruz");
    expect(formatName(juan, "last_first_mi")).toBe("Dela Cruz, Juan Miguel P.");
  });

  it("drops the initial when there is no middle name", () => {
    expect(formatName({ ...juan, middle_name: " " }, "first_mi_last")).toBe("Juan Miguel Dela Cruz");
    expect(formatName({ ...juan, middle_name: "" }, "last_first_mi")).toBe("Dela Cruz, Juan Miguel");
  });

  it("can print in capitals", () => {
    expect(fieldText({ ...defaultField("name"), uppercase: true }, juan)).toBe("JUAN MIGUEL P. DELA CRUZ");
  });
});

describe("fitSizePct", () => {
  const field = { sizePct: 10, widthPct: 50 };

  it("keeps the size when the text fits", () => {
    // 50% of a 1.5:1 page is 75% of its height wide (73.5% to fit); 5 ems at 10% is 50%.
    expect(fitSizePct(field, 1.5, 5)).toBe(10);
  });

  it("shrinks long text to the box width", () => {
    // 15 ems must fit in 73.5% of the page height: 4.9% per em.
    expect(fitSizePct(field, 1.5, 15)).toBeCloseTo(4.9);
  });
});

describe("parseFields", () => {
  it("fills in missing settings and skips unknown fields", () => {
    const [f, ...rest] = parseFields(JSON.stringify([{ key: "name", xPct: 3 }, { key: "photo" }]));
    expect(rest).toHaveLength(0);
    expect(f.xPct).toBe(3);
    expect(f.nameFormat).toBe("first_mi_last");
  });

  it("survives bad JSON", () => {
    expect(parseFields("{")).toEqual([]);
  });
});

describe("honors", () => {
  it("follows the DepEd bands", () => {
    expect([89, 90, 94, 95, 97, 98, 100].map(honorBand)).toEqual([null, 2, 2, 1, 1, 0, 0]);
    expect(honorBand(null)).toBeNull();
  });

  it("prints the honor and average for the learner's grade", () => {
    const honor = defaultField("honor");
    expect(fieldText(honor, juan)).toBe("With High Honors");
    expect(fieldText(honor, { ...juan, average: 98 })).toBe("With Highest Honors");
    expect(fieldText(honor, { ...juan, average: 85 })).toBe("");
    expect(fieldText({ ...honor, honorLabels: ["A", "B", "C"] }, { ...juan, average: 91 })).toBe("C");
    expect(fieldText(defaultField("average"), juan)).toBe("96");
    expect(fieldText(defaultField("average"), { ...juan, average: null })).toBe("");
  });
});

describe("other fields", () => {
  it("prints the award typed for the learner, or nothing", () => {
    expect(fieldText(defaultField("award"), { ...juan, award: " Best in Math " })).toBe("Best in Math");
    expect(fieldText(defaultField("award"), juan)).toBe("");
  });

  it("prints custom text and the print run's details", () => {
    expect(fieldText({ ...defaultField("text"), text: "Perfect Attendance" }, juan)).toBe("Perfect Attendance");
    const ctx = { ...SAMPLE_CONTEXT, schoolHead: "Ana Reyes", gradeSection: "Grade 4 – Sampaguita" };
    expect(fieldText(defaultField("school_head"), juan, ctx)).toBe("Ana Reyes");
    expect(fieldText(defaultField("grade_section"), juan, ctx)).toBe("Grade 4 – Sampaguita");
  });

  it("formats dates", () => {
    expect(formatDate("2026-10-27", "long")).toBe("October 27, 2026");
    expect(formatDate("2026-10-01", "ordinal")).toBe("1st day of October 2026");
    expect(formatDate("2026-10-12", "ordinal")).toBe("12th day of October 2026");
    expect(formatDate("2026-10-23", "ordinal")).toBe("23rd day of October 2026");
    expect(formatDate("2026-03-05", "numeric")).toBe("3/5/2026");
    expect(formatDate("", "long")).toBe("");
  });

  it("gives each custom text its own id", () => {
    expect(nextFieldId([{ id: "name" }], "text")).toBe("text");
    expect(nextFieldId([{ id: "text" }, { id: "text-2" }], "text")).toBe("text-3");
  });
});

describe("template types", () => {
  it("adds the fields a type needs and sets who gets one", () => {
    const { fields, recipients } = applyKind([defaultField("name")], "honors");
    expect(fields.map((f) => f.key)).toEqual(["name", "honor", "average"]);
    expect(recipients).toBe("honors");
  });

  it("never removes fields already placed", () => {
    const placed = [defaultField("name"), defaultField("date")];
    expect(applyKind(placed, "award").fields.map((f) => f.key)).toEqual(["name", "date", "award"]);
  });
});
