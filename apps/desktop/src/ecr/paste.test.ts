import { describe, expect, it } from "vitest";
import { parseClipboardGrid, planPaste } from "./paste";

const acts = [
  { id: 10, highest_score: 20 },
  { id: 11, highest_score: 0 },
];

describe("parseClipboardGrid", () => {
  it("splits Excel's tab-separated rows and drops the trailing line break", () => {
    expect(parseClipboardGrid("1\t2\r\n 3 \t\r\n")).toEqual([
      ["1", "2"],
      ["3", ""],
    ]);
  });
});

describe("planPaste", () => {
  it("places a block from the cell pasted into", () => {
    const plan = planPaste(
      [
        ["15", "8"],
        ["", "9"],
      ],
      { row: 0, col: 0 },
      [1, 2],
      acts,
    );
    expect(plan.scores).toEqual([
      { activityId: 10, learnerId: 1, value: 15 },
      { activityId: 11, learnerId: 1, value: 8 },
      { activityId: 10, learnerId: 2, value: null },
      { activityId: 11, learnerId: 2, value: 9 },
    ]);
    expect(plan.invalid).toBe(0);
  });

  it("skips scores that aren't numbers or are above the highest possible score", () => {
    const plan = planPaste([["21"], ["abc"], ["-1"]], { row: 0, col: 0 }, [1, 2, 3], acts);
    expect(plan.scores).toEqual([]);
    expect(plan.invalid).toBe(3);
  });

  it("uses a highest possible score pasted in the same block", () => {
    const plan = planPaste([["30"], ["25"]], { row: -1, col: 0 }, [1], acts);
    expect(plan.hps).toEqual([{ activityId: 10, value: 30 }]);
    expect(plan.scores).toEqual([{ activityId: 10, learnerId: 1, value: 25 }]);
  });

  it("counts cells past the last learner or column", () => {
    const plan = planPaste(
      [
        ["1", "2", "3"],
        ["4", "5", "6"],
      ],
      { row: 0, col: 1 },
      [1],
      acts,
    );
    expect(plan.scores).toEqual([{ activityId: 11, learnerId: 1, value: 1 }]);
    expect(plan.outside).toBe(5);
  });
});
