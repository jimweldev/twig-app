// School calendar for attendance. Dates are "YYYY-MM-DD" strings, compared as
// text and built in UTC so the local timezone never shifts a day.

import type { AttendanceStatus } from "@/lib/db";

export interface YearMonth {
  year: number;
  month: number; // 1-12
}

export interface SchoolYearRange {
  name: string; // "2026-2027"
  start_date: string;
  end_date: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
export const monthKey = (ym: YearMonth) => `${ym.year}-${pad(ym.month)}`;

export function todayIso(now = new Date()) {
  return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * First and last day of the school year. Uses the dates set on the school year,
 * else June 1 to March 31 of the named years.
 */
export function schoolYearBounds(sy: SchoolYearRange): { start: string; end: string } {
  const startYear = Number(sy.name.slice(0, 4));
  return {
    start: sy.start_date || isoDate(startYear, 6, 1),
    end: sy.end_date || isoDate(startYear + 1, 3, 31),
  };
}

/** Months the school year spans, in order. */
export function schoolMonths(sy: SchoolYearRange): YearMonth[] {
  const { start, end } = schoolYearBounds(sy);
  let year = Number(start.slice(0, 4));
  let month = Number(start.slice(5, 7));
  const endKey = end.slice(0, 7);
  const months: YearMonth[] = [];
  while (monthKey({ year, month }) <= endKey && months.length < 24) {
    months.push({ year, month });
    month = month === 12 ? 1 : month + 1;
    if (month === 1) year++;
  }
  return months;
}

const daysIn = (ym: YearMonth) => new Date(Date.UTC(ym.year, ym.month, 0)).getUTCDate();
export const weekdayOf = (iso: string) =>
  new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))).getUTCDay();

/** Monday-to-Friday dates of a month that fall inside the school year. */
export function weekdaysInMonth(ym: YearMonth, sy: SchoolYearRange): string[] {
  const { start, end } = schoolYearBounds(sy);
  const dates: string[] = [];
  for (let d = 1; d <= daysIn(ym); d++) {
    const iso = isoDate(ym.year, ym.month, d);
    const wd = weekdayOf(iso);
    if (wd !== 0 && wd !== 6 && iso >= start && iso <= end) dates.push(iso);
  }
  return dates;
}

export interface AttendanceTotals {
  schoolDays: number;
  present: number;
  absent: number;
  late: number;
}

/**
 * A learner's totals over the given dates: only school days (not no-class)
 * up to today count. Late counts as present.
 */
export function totalsFor(
  dates: string[],
  noClass: Set<string>,
  statusOf: (date: string) => AttendanceStatus | undefined,
  today: string,
): AttendanceTotals {
  const t: AttendanceTotals = { schoolDays: 0, present: 0, absent: 0, late: 0 };
  for (const date of dates) {
    if (noClass.has(date) || date > today) continue;
    t.schoolDays++;
    const s = statusOf(date);
    if (s === "A") t.absent++;
    else {
      t.present++;
      if (s === "L") t.late++;
    }
  }
  return t;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthShort = (ym: YearMonth) => MONTHS[ym.month - 1];
export const monthLong = (ym: YearMonth) =>
  new Date(Date.UTC(ym.year, ym.month - 1, 1)).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
