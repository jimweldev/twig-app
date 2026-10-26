import { Fragment } from "react";
import { useSchool } from "@/app/school";
import { Card } from "@/components/ui/card";
import type { ClassRecord, Learner } from "@/lib/db";
import { displayName } from "@/lib/names";
import type { LearnerGrades } from "./classGrades";
import { ExportGradesDialog } from "./ExportGradesDialog";
import { TERMS } from "./grading";
import { DESCRIPTIVE_CODES } from "./levels";
import { useDescriptiveRatings } from "./useDescriptiveRatings";

export const DESCRIPTIVE_COLORS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800",
  B: "bg-sky-100 text-sky-800",
  C: "bg-teal-50 text-teal-800",
  D: "bg-amber-100 text-amber-800",
  E: "bg-red-100 text-red-800",
};

export function DescriptiveLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground ${className}`}>
      <span className="font-medium text-foreground">Descriptive grades:</span>
      {DESCRIPTIVE_CODES.map((d) => (
        <span key={d.code} className="flex items-center gap-1.5">
          <span className={`rounded px-1.5 font-bold ${DESCRIPTIVE_COLORS[d.code]}`}>{d.code}</span> {d.name}
        </span>
      ))}
    </div>
  );
}

/** Grades 1-3 under descriptive grading: one A-E rating per term, plus a final rating. */
export function DescriptiveSheet({ classRecord, learners }: { classRecord: ClassRecord; learners: Learner[] }) {
  const { onError } = useSchool();
  const { loading, codeOf, setCode } = useDescriptiveRatings(classRecord.id, onError);

  const grades = new Map<number, LearnerGrades>(
    learners.map((l) => [l.id, { terms: TERMS.map((t) => codeOf(l.id, t)), final: codeOf(l.id, 4) }]),
  );
  const columns: [number, string][] = [...TERMS.map((t): [number, string] => [t, `Term ${t}`]), [4, "Final"]];
  const groups: ["M" | "F", string][] = [
    ["M", "Male"],
    ["F", "Female"],
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b bg-background px-6 py-2">
        <DescriptiveLegend />
        <ExportGradesDialog classRecord={classRecord} learners={learners} grades={grades} terms={TERMS} onError={onError} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
          Under DO 015, s. 2026 this grade uses descriptive grading. Rate each learner from your assessments and
          observations; no numerical grade or general average is computed.
        </p>
        {!loading && (
          <Card className="w-fit py-0">
            <table className="border-collapse bg-white text-sm">
              <thead>
                <tr className="bg-stone-50 text-xs text-stone-700">
                  <th className="w-8 border border-stone-200">#</th>
                  <th className="min-w-56 border border-stone-200 px-2 text-left">Learner</th>
                  {columns.map(([t, label]) => (
                    <th key={t} className={`w-24 border border-stone-200 px-2 py-1.5 ${t === 4 ? "bg-stone-100" : ""}`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(([sex, label]) => (
                  <Fragment key={sex}>
                    <tr>
                      <td colSpan={columns.length + 2} className="border border-stone-200 bg-stone-100 px-2 py-1 text-xs font-bold tracking-wide text-stone-600 uppercase">
                        {label}
                      </td>
                    </tr>
                    {learners
                      .filter((l) => l.sex === sex)
                      .map((l, i) => (
                        <tr key={l.id}>
                          <td className="border border-stone-200 px-1.5 text-right text-xs text-stone-400">{i + 1}</td>
                          <td className="border border-stone-200 px-2 whitespace-nowrap">{displayName(l)}</td>
                          {columns.map(([t]) => {
                            const code = codeOf(l.id, t);
                            return (
                              <td key={t} className={`border border-stone-200 p-0 ${code ? DESCRIPTIVE_COLORS[code] : ""}`}>
                                <select
                                  aria-label={`${displayName(l)} ${t === 4 ? "final" : `term ${t}`}`}
                                  value={code ?? ""}
                                  onChange={(e) => setCode(l.id, t, "", e.target.value || null)}
                                  className="h-8 w-full cursor-pointer bg-transparent text-center font-bold outline-none focus:ring-2 focus:ring-primary focus:ring-inset"
                                >
                                  <option value="">—</option>
                                  {DESCRIPTIVE_CODES.map((d) => (
                                    <option key={d.code} value={d.code}>
                                      {d.code} – {d.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        {learners.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">No learners in this section yet. Use the Learners button above.</p>
        )}
      </div>
    </div>
  );
}
