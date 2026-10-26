import { describe, expect, it } from "vitest";
import { schoolMonths, schoolYearBounds, totalsFor, weekdaysInMonth } from "./calendar";

const sy = { name: "2026-2027", start_date: "", end_date: "" };

describe("school calendar", () => {
  it("defaults to June 1 – March 31 when the school year has no dates", () => {
    expect(schoolYearBounds(sy)).toEqual({ start: "2026-06-01", end: "2027-03-31" });
    const months = schoolMonths(sy);
    expect(months).toHaveLength(10);
    expect(months[0]).toEqual({ year: 2026, month: 6 });
    expect(months[9]).toEqual({ year: 2027, month: 3 });
  });

  it("uses the school year's own dates", () => {
    const custom = { name: "2026-2027", start_date: "2026-06-15", end_date: "2027-04-10" };
    expect(schoolMonths(custom).map((m) => m.month)).toEqual([6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4]);
    const june = weekdaysInMonth({ year: 2026, month: 6 }, custom);
    expect(june[0]).toBe("2026-06-15"); // a Monday; earlier June days are before the opening
    const april = weekdaysInMonth({ year: 2027, month: 4 }, custom);
    expect(april[april.length - 1]).toBe("2027-04-09"); // Apr 10 is a Saturday
  });

  it("lists Monday to Friday only", () => {
    // October 2026 starts on a Thursday and has 22 weekdays.
    const oct = weekdaysInMonth({ year: 2026, month: 10 }, sy);
    expect(oct).toHaveLength(22);
    expect(oct.slice(0, 3)).toEqual(["2026-10-01", "2026-10-02", "2026-10-05"]);
  });
});

describe("totalsFor", () => {
  const dates = ["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06", "2026-10-07"];
  const marks: Record<string, "A" | "L"> = { "2026-10-02": "A", "2026-10-05": "L", "2026-10-07": "A" };

  it("skips no-class days and future days; late counts as present", () => {
    const t = totalsFor(dates, new Set(["2026-10-01"]), (d) => marks[d], "2026-10-06");
    expect(t).toEqual({ schoolDays: 3, present: 2, absent: 1, late: 1 });
  });
});
