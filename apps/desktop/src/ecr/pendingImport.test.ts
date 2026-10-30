import { describe, expect, it } from "vitest";
import type { ImportSnapshot } from "@/lib/db";
import { parseSnapshot, serializeSnapshot } from "./pendingImport";

describe("pending import snapshot", () => {
  it("survives being saved as text, score maps included", () => {
    const snapshot: ImportSnapshot = {
      sectionId: 1,
      learningArea: "Filipino",
      learnerIds: [1, 2],
      received: null,
      classId: 3,
      terms: [
        {
          term: 2,
          activities: [{ component: "WW", position: 1, highest_score: 20, scores: new Map([[1, 18]]) }],
        },
      ],
    };
    expect(parseSnapshot(serializeSnapshot(snapshot))).toEqual(snapshot);
  });
});
