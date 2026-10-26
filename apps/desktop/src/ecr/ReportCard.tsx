import { Fragment } from "react";
import { monthShort, todayIso, type AttendanceTotals, type YearMonth } from "@/attendance/calendar";
import type { Learner, Marking, SchoolProfile, SchoolYear, Section } from "@/lib/db";
import { ageOn } from "@/lib/names";
import { CORE_VALUES, MARKINGS } from "./observedValues";
import type { GradeValue } from "./classGrades";
import { descriptor, DESCRIPTOR_SCALE, PASSING_GRADE, TERMS } from "./grading";
import {
  DESCRIPTIVE_CODES,
  gradeLabel,
  isSeniorHigh,
  KINDER_CODES,
  KINDER_DOMAINS,
  SHS_CORE_SUBJECTS,
  subjectTypeOf,
  type GradingMode,
} from "./levels";
import { generalAverage, gradeIn, type AreaSource } from "./useSectionGrades";

const fullName = (l: Learner) =>
  `${l.last_name.toUpperCase()}, ${l.first_name}${l.middle_name.trim() ? ` ${l.middle_name}` : ""}`;

export interface LearnerAttendance {
  months: YearMonth[];
  perMonth: AttendanceTotals[];
  total: AttendanceTotals;
}

const remark = (g: GradeValue) => (typeof g !== "number" ? "" : g >= PASSING_GRADE ? "Passed" : "Failed");

/** Senior High report cards list core subjects first. */
const shsCategory = (a: AreaSource) =>
  subjectTypeOf(a.kind === "local" ? (a.subjectType ?? "") : "")?.category ??
  (SHS_CORE_SUBJECTS.includes(a.area) ? "Core" : "Applied and Specialized");

const DESCRIPTORS = DESCRIPTOR_SCALE.map((d) => [d.name, d.range, d.passed ? "Passed" : "Failed"] as const);

function Line({ label, value, className = "" }: { label: string; value?: string | number; className?: string }) {
  return (
    <div className={`flex items-end gap-1.5 ${className}`}>
      <span className="shrink-0">{label}:</span>
      <span className="min-h-[1.2em] flex-1 border-b border-black px-1 font-semibold">{value}</span>
    </div>
  );
}

function Signature({ name, role }: { name: string; role: string }) {
  return (
    <div className="text-center">
      <div className="min-h-[1.3em] border-b border-black font-semibold uppercase">{name}</div>
      <div className="text-[9pt]">{role}</div>
    </div>
  );
}

const PAGE =
  "report-page mx-auto flex h-[297mm] w-[210mm] flex-col bg-white p-[14mm] font-[Arial,sans-serif] text-[10pt] leading-snug text-black shadow-lg print:shadow-none";

/** Two A4 pages: the SF9-style progress report card, then observed values. */
export function ReportCard({
  profile,
  schoolYear,
  section,
  learner,
  areas,
  attendance,
  markingOf,
  mode,
  kinderCodeOf,
}: {
  profile: SchoolProfile;
  schoolYear: SchoolYear;
  section: Section;
  learner: Learner;
  areas: AreaSource[];
  /** Monthly attendance; omitted for sections without attendance (prints blank). */
  attendance?: LearnerAttendance;
  /** Observed-values marking per term and behavior; omitted prints blank. */
  markingOf?: (term: number, behavior: string) => Marking | undefined;
  /** How this grade level is graded (numeric, descriptive A-E, or Kindergarten domains). */
  mode: GradingMode;
  /** Kindergarten rating per term and domain. */
  kinderCodeOf?: (term: number, domain: string) => string | null;
}) {
  const ga = generalAverage(areas, learner.id);
  const cell = "border border-black px-1.5 py-[3px]";

  return (
    <>
    <article className={PAGE}>
      <div className="flex justify-between text-[8pt]">
        <span>SF 9 – Learner's Progress Report Card</span>
        <span>LRN: {learner.lrn || "____________"}</span>
      </div>

      <header className="mt-2 text-center leading-tight">
        <div>Republic of the Philippines</div>
        <div className="font-bold">DEPARTMENT OF EDUCATION</div>
        {profile.region && <div>{profile.region}</div>}
        {profile.division && <div>Division of {profile.division}</div>}
        {profile.district && <div>{profile.district} District</div>}
        <div className="mt-1 text-[12pt] font-bold uppercase">{profile.school_name || "School name"}</div>
        {profile.school_id && <div className="text-[9pt]">School ID: {profile.school_id}</div>}
        <h1 className="mt-3 text-[13pt] font-bold tracking-wide">LEARNER'S PROGRESS REPORT CARD</h1>
        <div>School Year {schoolYear.name}</div>
      </header>

      <section className="mt-4 grid grid-cols-6 gap-x-4 gap-y-1.5">
        <Line className="col-span-4" label="Name" value={fullName(learner)} />
        <Line className="col-span-2" label="Sex" value={learner.sex === "M" ? "Male" : "Female"} />
        <Line className="col-span-2" label="Grade" value={section.grade_level === 0 ? gradeLabel(0) : section.grade_level} />
        <Line className="col-span-2" label="Section" value={section.name} />
        <Line className="col-span-2" label="Age" value={ageOn(learner.birthdate, todayIso()) ?? undefined} />
      </section>

      {mode === "kinder" ? (
        <>
          <h2 className="mt-5 text-center font-bold">REPORT ON DEVELOPMENTAL PROGRESS</h2>
          <table className="mt-2 w-full border-collapse text-center">
            <thead>
              <tr className="font-bold">
                <th className={`${cell} w-[64%] text-left`} rowSpan={2}>
                  Developmental Domains
                </th>
                <th className={cell} colSpan={3}>
                  Term
                </th>
              </tr>
              <tr className="font-bold">
                {TERMS.map((t) => (
                  <th key={t} className={cell}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {KINDER_DOMAINS.map((d) => (
                <tr key={d.key}>
                  <td className={`${cell} text-left`}>{d.name}</td>
                  {TERMS.map((t) => (
                    <td key={t} className={`${cell} font-semibold`}>
                      {kinderCodeOf?.(t, d.key) ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <h2 className="mt-5 text-center font-bold">REPORT ON LEARNING PROGRESS AND ACHIEVEMENT</h2>
          <table className="mt-2 w-full border-collapse text-center">
            <thead>
              <tr className="font-bold">
                <th className={`${cell} w-[38%] text-left`} rowSpan={2}>
                  {isSeniorHigh(section.grade_level) ? "Subjects" : "Learning Areas"}
                </th>
                <th className={cell} colSpan={3}>
                  Term
                </th>
                <th className={cell} rowSpan={2}>
                  {mode === "descriptive" ? "Final" : "Final Grade"}
                </th>
                {mode === "numeric" && (
                  <th className={cell} rowSpan={2}>
                    Remarks
                  </th>
                )}
              </tr>
              <tr className="font-bold">
                {TERMS.map((t) => (
                  <th key={t} className={`${cell} w-[9%]`}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(isSeniorHigh(section.grade_level)
                ? (["Core", "Applied and Specialized"] as const).map((cat) => ({
                    heading: `${cat} Subjects`,
                    rows: areas.filter((a) => shsCategory(a) === cat),
                  }))
                : [{ heading: "", rows: areas }]
              ).map(({ heading, rows }) =>
                rows.length === 0 ? null : (
                  <Fragment key={heading || "all"}>
                    {heading && (
                      <tr>
                        <td className={`${cell} text-left font-bold`} colSpan={mode === "numeric" ? 6 : 5}>
                          {heading}
                        </td>
                      </tr>
                    )}
                    {rows.map((a) => {
                      const final = gradeIn(a, learner.id, "final");
                      return (
                        <tr key={a.area}>
                          <td className={`${cell} text-left`}>{a.area}</td>
                          {[0, 1, 2].map((t) => (
                            <td key={t} className={cell}>
                              {gradeIn(a, learner.id, t as 0 | 1 | 2) ?? ""}
                            </td>
                          ))}
                          <td className={`${cell} font-semibold`}>{final ?? ""}</td>
                          {mode === "numeric" && <td className={cell}>{remark(final)}</td>}
                        </tr>
                      );
                    })}
                  </Fragment>
                ),
              )}
              {mode === "numeric" && (
                <tr className="font-bold">
                  <td className={`${cell} text-right`} colSpan={4}>
                    General Average
                  </td>
                  <td className={cell}>{ga ?? ""}</td>
                  <td className={cell}>{remark(ga)}</td>
                </tr>
              )}
            </tbody>
          </table>
          {mode === "numeric" && ga !== null && (
            <p className="mt-1 text-[9pt]">
              Descriptor: <span className="font-semibold">{descriptor(ga)}</span>
            </p>
          )}
        </>
      )}

      <h2 className="mt-4 text-center font-bold">ATTENDANCE RECORD</h2>
      <table className="mt-1 w-full table-fixed border-collapse text-center text-[8.5pt]">
        <thead>
          <tr className="font-bold">
            <th className={`${cell} w-[22%]`} />
            {(attendance?.months ?? []).map((m) => (
              <th key={`${m.year}-${m.month}`} className={cell}>
                {monthShort(m)}
              </th>
            ))}
            <th className={cell}>Total</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              ["No. of school days", "schoolDays"],
              ["No. of days present", "present"],
              ["No. of days absent", "absent"],
            ] as const
          ).map(([label, key]) => (
            <tr key={key}>
              <td className={`${cell} text-left`}>{label}</td>
              {(attendance?.perMonth ?? []).map((t, i) => (
                <td key={i} className={cell}>
                  {t.schoolDays > 0 ? t[key] : ""}
                </td>
              ))}
              <td className={`${cell} font-semibold`}>
                {attendance && attendance.total.schoolDays > 0 ? attendance.total[key] : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="mt-4 w-1/2 border-collapse text-[9pt]">
        <thead>
          <tr className="font-bold">
            <th className={cell}>{mode === "numeric" ? "Descriptor" : "Rating"}</th>
            <th className={cell}>{mode === "numeric" ? "Grading Scale" : "Meaning"}</th>
            {mode === "numeric" && <th className={cell}>Remarks</th>}
          </tr>
        </thead>
        <tbody>
          {mode === "numeric" &&
            DESCRIPTORS.map(([d, scale, r]) => (
              <tr key={d}>
                <td className={cell}>{d}</td>
                <td className={`${cell} text-center`}>{scale}</td>
                <td className={`${cell} text-center`}>{r}</td>
              </tr>
            ))}
          {mode !== "numeric" &&
            (mode === "kinder" ? KINDER_CODES : DESCRIPTIVE_CODES).map((c) => (
              <tr key={c.code}>
                <td className={`${cell} text-center font-semibold`}>{c.code}</td>
                <td className={cell}>{c.name}</td>
              </tr>
            ))}
        </tbody>
      </table>

      <section className="mt-auto pt-6">
        <div className="grid grid-cols-2 gap-16 px-6">
          <Signature name={section.adviser || profile.teacher_name} role="Class Adviser" />
          <Signature name={profile.school_head} role="School Head" />
        </div>
        <div className="mt-6">
          <div className="text-[9pt] font-bold">Parent / Guardian's Signature</div>
          <div className="mt-1 grid grid-cols-3 gap-6 text-[9pt]">
            {TERMS.map((t) => (
              <div key={t} className="flex items-end gap-1.5">
                <span className="shrink-0">Term {t}:</span>
                <span className="h-[1.6em] flex-1 border-b border-black" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </article>

    <article className={PAGE}>
      <div className="flex justify-between text-[8pt]">
        <span>SF 9 – Learner's Progress Report Card</span>
        <span>{fullName(learner)}</span>
      </div>

      <h2 className="mt-6 text-center text-[12pt] font-bold">REPORT ON LEARNER'S OBSERVED VALUES</h2>
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="font-bold">
            <th className={`${cell} w-[18%]`} rowSpan={2}>
              Core Values
            </th>
            <th className={cell} rowSpan={2}>
              Behavior Statements
            </th>
            <th className={cell} colSpan={3}>
              Term
            </th>
          </tr>
          <tr className="font-bold">
            {TERMS.map((t) => (
              <th key={t} className={`${cell} w-[9%]`}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CORE_VALUES.map((v, vi) =>
            v.behaviors.map((b, i) => (
              <tr key={b.key}>
                {i === 0 && (
                  <td className={`${cell} text-center font-semibold`} rowSpan={v.behaviors.length}>
                    {vi + 1}. {v.name}
                  </td>
                )}
                <td className={`${cell} py-2`}>{b.text}</td>
                {TERMS.map((t) => (
                  <td key={t} className={`${cell} text-center font-semibold`}>
                    {markingOf?.(t, b.key) ?? ""}
                  </td>
                ))}
              </tr>
            )),
          )}
        </tbody>
      </table>

      <table className="mt-6 w-1/2 border-collapse text-[9pt]">
        <thead>
          <tr className="font-bold">
            <th className={cell}>Marking</th>
            <th className={cell}>Non-numerical Rating</th>
          </tr>
        </thead>
        <tbody>
          {MARKINGS.map((m) => (
            <tr key={m.code}>
              <td className={`${cell} text-center`}>{m.code}</td>
              <td className={cell}>{m.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
    </>
  );
}
