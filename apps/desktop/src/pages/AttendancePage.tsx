import { Fragment, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useRouter } from "@/app/router";
import { useSchool } from "@/app/school";
import { EmptyState, PageHeader } from "@/components/page";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  monthKey,
  monthLong,
  schoolMonths,
  todayIso,
  totalsFor,
  weekdayOf,
  weekdaysInMonth,
  type YearMonth,
} from "@/attendance/calendar";
import { useAttendance } from "@/attendance/useAttendance";
import { listLearners, type AttendanceStatus, type Learner, type SchoolYear, type Section } from "@/lib/db";
import { displayName } from "@/lib/names";
import { gradeLabel } from "@/ecr/levels";

const WEEKDAY = ["Su", "M", "T", "W", "Th", "F", "Sa"];

// Clicking a cell cycles present → absent → late → present.
const NEXT: Record<"P" | AttendanceStatus, AttendanceStatus | null> = { P: "A", A: "L", L: null };

function AttendanceGrid({ schoolYear, section }: { schoolYear: SchoolYear; section: Section }) {
  const { onError } = useSchool();
  const [learners, setLearners] = useState<Learner[]>([]);
  const { noClass, loading, statusOf, setMark, toggleNoClass } = useAttendance(section.id, onError);

  const months = schoolMonths(schoolYear);
  const today = todayIso();
  const [current, setCurrent] = useState<YearMonth>(
    () => months.find((m) => monthKey(m) === today.slice(0, 7)) ?? months[0],
  );
  const index = months.findIndex((m) => monthKey(m) === monthKey(current));

  useEffect(() => {
    listLearners(section.id).then(setLearners, onError);
  }, [section.id, onError]);

  const days = weekdaysInMonth(current, schoolYear);
  const groups: ["M" | "F", string][] = [
    ["M", "Male"],
    ["F", "Female"],
  ];

  const presentOn = (date: string) => learners.filter((l) => statusOf(l.id, date) !== "A").length;
  const cellBase = "h-8 w-8 min-w-8 border border-stone-200 p-0 text-center text-xs";
  // Thicker edges (same color) around each Monday–Friday week so weeks are easy to tell apart.
  const dayCell = (d: string) => {
    const wd = weekdayOf(d);
    return `${cellBase} ${wd === 1 ? "border-l-[3px]" : ""} ${wd === 5 ? "border-r-[3px]" : ""}`;
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon-sm" title="Previous month" disabled={index <= 0} onClick={() => setCurrent(months[index - 1])}>
          <ChevronLeft />
        </Button>
        <SimpleSelect
          className="w-48"
          value={monthKey(current)}
          onValueChange={(v) => setCurrent(months.find((m) => monthKey(m) === v)!)}
          options={months.map((m) => ({ value: monthKey(m), label: monthLong(m) }))}
        />
        <Button
          variant="outline"
          size="icon-sm"
          title="Next month"
          disabled={index >= months.length - 1}
          onClick={() => setCurrent(months[index + 1])}
        >
          <ChevronRight />
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block size-3.5 rounded-sm border bg-white" /> Present
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-grid size-3.5 place-items-center rounded-sm bg-red-100 text-[9px] font-bold text-red-700">A</span> Absent
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-grid size-3.5 place-items-center rounded-sm bg-amber-100 text-[9px] font-bold text-amber-700">L</span> Late
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-3.5 rounded-sm bg-stone-200" /> No class
          </span>
        </div>
      </div>

      {learners.length === 0 ? (
        <EmptyState title="No learners in this section yet" />
      ) : (
        !loading && (
          <Card className="overflow-x-auto py-0">
            <table className="border-collapse bg-white text-sm">
              <thead>
                <tr className="bg-stone-50 text-stone-700">
                  <th className="sticky left-0 z-20 w-8 min-w-8 border border-stone-200 bg-stone-50 text-xs">#</th>
                  <th className="sticky left-8 z-20 min-w-56 border border-stone-200 bg-stone-50 px-2 text-left text-xs">
                    Learner
                  </th>
                  {days.map((d) => {
                    const off = noClass.has(d);
                    const future = d > today;
                    return (
                      <th key={d} className={`${dayCell(d)} ${off ? "bg-stone-200" : ""} ${d === today ? "bg-primary/10" : ""}`}>
                        <button
                          type="button"
                          title={off ? "No class — click to make it a school day" : "Click to mark as no class (holiday, suspension)"}
                          onClick={() => toggleNoClass(d)}
                          className={`flex h-full w-full flex-col items-center justify-center leading-none hover:bg-stone-100 ${
                            future ? "text-stone-400" : ""
                          }`}
                        >
                          <span className="font-semibold">{Number(d.slice(8))}</span>
                          <span className="text-[9px] font-normal">{WEEKDAY[weekdayOf(d)]}</span>
                        </button>
                      </th>
                    );
                  })}
                  <th className="border border-stone-200 px-2 text-xs">Present</th>
                  <th className="border border-stone-200 px-2 text-xs">Absent</th>
                  <th className="border border-stone-200 px-2 text-xs">Late</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([sex, label]) => (
                  <Fragment key={sex}>
                    <tr>
                      <td
                        colSpan={days.length + 5}
                        className="border border-stone-200 bg-stone-100 px-2 py-1 text-xs font-bold tracking-wide text-stone-600 uppercase"
                      >
                        {label}
                      </td>
                    </tr>
                    {learners
                      .filter((l) => l.sex === sex)
                      .map((l, i) => {
                        const t = totalsFor(days, noClass, (d) => statusOf(l.id, d), today);
                        return (
                          <tr key={l.id} className="hover:bg-emerald-50/40">
                            <td className="sticky left-0 z-10 border border-stone-200 bg-white px-1.5 text-right text-xs text-stone-400">
                              {i + 1}
                            </td>
                            <td className="sticky left-8 z-10 border border-stone-200 bg-white px-2 whitespace-nowrap">
                              {displayName(l)}
                            </td>
                            {days.map((d) => {
                              if (noClass.has(d)) return <td key={d} className={`${dayCell(d)} bg-stone-200`} />;
                              if (d > today) return <td key={d} className={`${dayCell(d)} bg-stone-50`} />;
                              const s = statusOf(l.id, d);
                              return (
                                <td key={d} className={dayCell(d)}>
                                  <button
                                    type="button"
                                    title={`${displayName(l)} · ${d}: ${s === "A" ? "absent" : s === "L" ? "late" : "present"}`}
                                    onClick={() => setMark(l.id, d, NEXT[s ?? "P"])}
                                    className={`h-full w-full font-bold ${
                                      s === "A"
                                        ? "bg-red-100 text-red-700"
                                        : s === "L"
                                          ? "bg-amber-100 text-amber-700"
                                          : "hover:bg-emerald-50"
                                    }`}
                                  >
                                    {s ?? ""}
                                  </button>
                                </td>
                              );
                            })}
                            <td className="border border-stone-200 px-2 text-center tabular-nums">{t.present}</td>
                            <td className={`border border-stone-200 px-2 text-center tabular-nums ${t.absent ? "text-red-700" : ""}`}>
                              {t.absent}
                            </td>
                            <td className={`border border-stone-200 px-2 text-center tabular-nums ${t.late ? "text-amber-700" : ""}`}>
                              {t.late}
                            </td>
                          </tr>
                        );
                      })}
                  </Fragment>
                ))}
                <tr className="bg-stone-50 font-semibold">
                  <td className="sticky left-0 z-10 border border-stone-200 bg-stone-50" />
                  <td className="sticky left-8 z-10 border border-stone-200 bg-stone-50 px-2 text-xs">Present per day</td>
                  {days.map((d) => (
                    <td key={d} className={`${dayCell(d)} ${noClass.has(d) ? "bg-stone-200" : ""}`}>
                      {noClass.has(d) || d > today ? "" : presentOn(d)}
                    </td>
                  ))}
                  <td colSpan={3} className="border border-stone-200" />
                </tr>
              </tbody>
            </table>
          </Card>
        )
      )}
    </>
  );
}

export function AttendancePage() {
  const { navigate } = useRouter();
  const { activeYear, sections } = useSchool();
  const advisory = sections.find((s) => s.is_advisory);

  return (
    <div className="mx-auto max-w-[96rem] p-8">
      <PageHeader
        title="Attendance"
        description={
          advisory
            ? `${gradeLabel(advisory.grade_level)} – ${advisory.name} · your advisory class · SY ${activeYear?.name}`
            : "Daily attendance of your advisory class"
        }
      />
      <div className="mt-6">
        {!advisory || !activeYear ? (
          <EmptyState title="No advisory class">
            <p>Attendance is kept for your advisory class. Mark it in Sections first.</p>
            <Button className="mt-4" onClick={() => navigate({ page: "sections" })}>
              Go to sections
            </Button>
          </EmptyState>
        ) : (
          <>
            <p className="mb-4 flex items-start gap-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>
                Everyone is present unless marked. Click a learner's day to cycle absent → late → present. Click a date
                to mark no class (holiday or suspension). Days after today stay locked until they arrive, so totals only
                count school days that have happened.
                {!activeYear.start_date && (
                  <>
                    {" "}
                    School days run June 1 – March 31 until you{" "}
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => navigate({ page: "schoolYears" })}
                    >
                      set the school year's dates
                    </button>
                    .
                  </>
                )}
              </span>
            </p>
            <AttendanceGrid key={advisory.id} schoolYear={activeYear} section={advisory} />
          </>
        )}
      </div>
    </div>
  );
}
