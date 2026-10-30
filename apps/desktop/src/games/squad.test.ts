import { describe, expect, it } from "vitest";
import type { Learner } from "@/lib/db";
import { makeGroups } from "./SquadUp";

const learners: Learner[] = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  section_id: 1,
  lrn: "",
  last_name: `L${i}`,
  first_name: `F${i}`,
  middle_name: "",
  sex: i % 2 ? "F" : "M",
  birthdate: "",
}));

describe("makeGroups", () => {
  it("puts everyone in exactly one group, sizes differing by at most one", () => {
    const lists = makeGroups(learners, 5, new Set());
    const all = Object.values(lists).flat();
    expect(all.sort((a, b) => a - b)).toEqual(learners.map((l) => l.id));
    const sizes = Object.values(lists).map((g) => g.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it("deals one leader to each group", () => {
    const leaders = new Set([2, 7, 11, 19]);
    for (let run = 0; run < 20; run++) {
      const lists = makeGroups(learners, 4, leaders);
      for (const g of Object.values(lists)) expect(g.filter((id) => leaders.has(id))).toHaveLength(1);
    }
  });

  it("spreads extra leaders evenly when there are more leaders than groups", () => {
    const lists = makeGroups(learners, 3, new Set([1, 2, 3, 4, 5]));
    const perGroup = Object.values(lists).map((g) => g.filter((id) => id <= 5).length);
    expect(Math.max(...perGroup) - Math.min(...perGroup)).toBeLessThanOrEqual(1);
  });
});
