import { useState } from "react";
import { cn } from "cn";
import type { ClassRecord, Learner, Section } from "@/lib/db";
import { displayName } from "@/lib/names";
import type { GradeValue } from "./classGrades";
import type { PacketLearner } from "./exchange";
import { useSectionGrades } from "./useSectionGrades";

const show = (g: GradeValue) => (g === null || g === "" ? "—" : String(g));
const same = (a: GradeValue, b: GradeValue) => (a ?? "") === (b ?? "");

/**
 * Each matched learner's grade here now next to the grade in the file, for every term
 * the import writes to. Mounted only when opened, since it loads the section's grades.
 */
export function ImportChanges({
  section,
  learners,
  localClasses,
  area,
  partId,
  pairs,
  matched,
  onError,
}: {
  section: Section;
  learners: Learner[];
  localClasses: ClassRecord[];
  /** The learning area the grades go into. */
  area: string;
  /** MAPEH: the part the grades go into. */
  partId?: string;
  /** Each file term and the term here it goes into. */
  pairs: { from: number; to: number }[];
  matched: { incoming: PacketLearner; learner: Learner }[];
  onError: (e: unknown) => void;
}) {
  const { areas, loading } = useSectionGrades(section, learners, localClasses, onError);
  const [showAll, setShowAll] = useState(false);

  if (loading) return <p className="text-xs text-muted-foreground">Loading the current grades…</p>;

  const source = areas.find((a) => a.area === area);
  const grades = partId ? source?.parts?.find((x) => x.part.id === partId)?.grades : source?.grades;
  const current = (learnerId: number, term: number): GradeValue => grades?.get(learnerId)?.terms[term - 1] ?? null;

  const rows = matched.map(({ incoming, learner }) => {
    const cells = pairs.map(({ from, to }) => ({
      before: current(learner.id, to),
      after: incoming.terms[from - 1] ?? null,
    }));
    return { learner, cells, changed: cells.some((c) => !same(c.before, c.after)) };
  });
  const changed = rows.filter((r) => r.changed).length;
  const shown = showAll ? rows : rows.filter((r) => r.changed);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {changed === 0
            ? "No grades change."
            : `${changed} of ${rows.length} learner${rows.length === 1 ? "" : "s"} get a different grade.`}
        </span>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="accent-primary" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show unchanged
        </label>
      </div>
      {shown.length > 0 && (
        <div className="max-h-56 overflow-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Learner</th>
                {pairs.map(({ to }) => (
                  <th key={to} className="px-2 py-1.5 text-center font-medium">
                    Term {to}: now → new
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map(({ learner, cells }) => (
                <tr key={learner.id} className="border-t">
                  <td className="px-2 py-1">{displayName(learner)}</td>
                  {cells.map((c, i) => {
                    const diff = !same(c.before, c.after);
                    return (
                      <td key={i} className="px-2 py-1 text-center tabular-nums">
                        <span className={cn(diff && "text-muted-foreground line-through")}>{show(c.before)}</span>
                        <span className="mx-1 text-muted-foreground">→</span>
                        <span className={cn(diff && "font-semibold text-primary")}>{show(c.after)}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
