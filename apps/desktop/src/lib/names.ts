import type { Learner, NewLearner, Sex } from "@/lib/db";

/** "DELA CRUZ, Juan M." — DepEd class list order is last name first. */
export function displayName(l: Pick<Learner, "last_name" | "first_name" | "middle_name">) {
  const mi = l.middle_name.trim() ? ` ${l.middle_name.trim()[0].toUpperCase()}.` : "";
  return `${l.last_name.toUpperCase()}, ${l.first_name}${mi}`;
}

const isLrn = (s: string) => /^\d{12}$/.test(s.trim());

/**
 * Parses one pasted line into a learner. Accepts:
 * - "LAST, FIRST" or "LAST, FIRST, MIDDLE"
 * - tab-separated cells copied from Excel: [LRN] LAST FIRST [MIDDLE]
 */
export function parseLearnerLine(line: string, sex: Sex): NewLearner | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let cells = trimmed.includes("\t")
    ? trimmed.split("\t").map((c) => c.trim())
    : trimmed.split(",").map((c) => c.trim());
  let lrn = "";
  if (cells.length > 1 && isLrn(cells[0])) {
    lrn = cells[0];
    cells = cells.slice(1);
  }
  // A trailing date cell (e.g. from an LIS export) is the birthdate.
  const birthdate = cells.length > 2 ? normalizeDate(cells[cells.length - 1]) : "";
  if (birthdate) cells = cells.slice(0, -1);
  const [last_name = "", first_name = "", middle_name = ""] = cells;
  if (!last_name || !first_name) return null;
  return { lrn, last_name, first_name, middle_name, sex, birthdate };
}

export function currentSchoolYear(now = new Date()) {
  // School year opens mid-year; June onward belongs to the new SY.
  const y = now.getFullYear();
  return now.getMonth() >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/** "2026-2027" -> true; the second year must follow the first. */
export function isValidSchoolYear(name: string) {
  const m = /^(\d{4})-(\d{4})$/.exec(name.trim());
  return !!m && Number(m[2]) === Number(m[1]) + 1;
}

/** Suggests the school year after the latest existing one, or the current one. */
export function suggestSchoolYear(existing: string[]) {
  const starts = existing.filter(isValidSchoolYear).map((n) => Number(n.slice(0, 4)));
  if (starts.length === 0) return currentSchoolYear();
  const next = Math.max(...starts) + 1;
  return `${next}-${next + 1}`;
}

/** "2014-03-09" or "3/9/2014" (month first, as Excel shows it in the Philippines) -> "2014-03-09"; else "". */
export function normalizeDate(text: string): string {
  const t = text.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) [m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else return "";
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return "";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Whole years from a YYYY-MM-DD birthdate to another YYYY-MM-DD date; null when unknown. */
export function ageOn(birthdate: string, onDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return null;
  const [by, bm, bd] = birthdate.split("-").map(Number);
  const [y, m, d] = onDate.split("-").map(Number);
  const age = y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
  return age >= 0 ? age : null;
}
