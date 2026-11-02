/** Splits text copied from Excel or Google Sheets (tab-separated, one line per row) into cells. */
export function parseClipboardGrid(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  return lines.map((line) => line.split("\t").map((cell) => cell.trim()));
}

export interface PastePlan {
  /** New highest possible scores, from cells pasted onto the HPS row. */
  hps: { activityId: number; value: number }[];
  /** Scores to save; null clears a score, as pasting a blank cell does in Excel. */
  scores: { activityId: number; learnerId: number; value: number | null }[];
  /** Cells that aren't a valid score: not a number, negative, or above the highest possible score. */
  invalid: number;
  /** Cells past the last learner or the last score column. */
  outside: number;
}

/**
 * Lays a pasted block over the sheet, its top-left cell at the cell pasted into.
 * Row -1 is the highest-possible-score row; rows 0.. are learners in sheet order.
 * A pasted HPS applies to the scores pasted below it in the same block.
 */
export function planPaste(
  grid: string[][],
  start: { row: number; col: number },
  learnerIds: number[],
  activities: { id: number; highest_score: number }[],
): PastePlan {
  const plan: PastePlan = { hps: [], scores: [], invalid: 0, outside: 0 };
  const max = new Map(activities.map((a) => [a.id, a.highest_score]));
  grid.forEach((cells, i) =>
    cells.forEach((cell, j) => {
      const row = start.row + i;
      const act = activities[start.col + j];
      if (!act || row >= learnerIds.length) {
        plan.outside++;
        return;
      }
      const value = cell === "" ? null : Number(cell);
      if (value !== null && (Number.isNaN(value) || value < 0)) {
        plan.invalid++;
        return;
      }
      if (row < 0) {
        max.set(act.id, value ?? 0);
        plan.hps.push({ activityId: act.id, value: value ?? 0 });
        return;
      }
      const hps = max.get(act.id);
      if (value !== null && hps && value > hps) {
        plan.invalid++;
        return;
      }
      plan.scores.push({ activityId: act.id, learnerId: learnerIds[row], value });
    }),
  );
  return plan;
}
