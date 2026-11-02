import { scoreKey, type Activity, type Learner } from "@/lib/db";
import { PASSING_GRADE, type Term } from "@/ecr/grading";
import { displayName } from "@/lib/names";
import {
  importedPartGrades,
  partTermGrades,
  termGrade,
  type GradingContext,
  type LearnerGrades,
  type PartImports,
} from "./classGrades";
import { DescriptorLegend } from "./DescriptorLegend";

/** One term of a learning area scored in parts (MAPEH): each part's term grade and their average. */
export function PartsTermGrades({
  term,
  learningArea,
  learners,
  activities,
  scores,
  ctx,
  imported,
  partImports,
}: {
  term: Term;
  learningArea: string;
  learners: Learner[];
  activities: Activity[];
  scores: Map<string, number>;
  ctx: GradingContext;
  /** Imported grades; an imported term grade replaces the average. */
  imported: Map<number, LearnerGrades>;
  /** Term grades imported for one part, which replace that part's own. */
  partImports: PartImports;
}) {
  const termActs = activities.filter((a) => a.term === term);
  const th = "border border-stone-300 px-2 py-1 font-semibold";
  const cell = "border border-stone-200 px-2 py-1 text-center tabular-nums";
  const graded = (g: number | null) =>
    g === null ? "" : g < PASSING_GRADE ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-900";

  const learnerRow = (l: Learner, index: number) => {
    const scoreOf = (id: number) => scores.get(scoreKey(id, l.id));
    const override = importedPartGrades(partImports, ctx, l.id, term);
    const parts = partTermGrades(termActs, scoreOf, ctx, override);
    const own = termGrade(termActs, scoreOf, ctx, override);
    const importedGrade = imported.get(l.id)?.terms[term - 1];
    const fromImport = typeof importedGrade === "number";
    const grade = fromImport ? importedGrade : own;
    return (
      <tr key={l.id} className="hover:bg-emerald-50/40">
        <td className="border border-stone-200 px-1.5 text-right text-stone-400">{index + 1}</td>
        <td className="min-w-56 border border-stone-200 px-2 whitespace-nowrap text-stone-800">{displayName(l)}</td>
        {parts.map((g, i) => (
          <td
            key={ctx.parts[i].id}
            className={`${cell} text-stone-700 ${override[i] !== null ? "italic" : ""}`}
            title={override[i] !== null ? "Imported grade" : undefined}
          >
            {g ?? ""}
          </td>
        ))}
        <td className={`${cell} font-bold ${graded(grade)}`}>
          {fromImport ? (
            <span className="italic" title={`Imported grade${own !== null ? `. Your scores give ${own}.` : ""}`}>
              {grade}
            </span>
          ) : (
            (grade ?? "")
          )}
        </td>
      </tr>
    );
  };

  const group = (sex: "M" | "F", label: string) => [
    <tr key={label}>
      <td
        colSpan={3 + ctx.parts.length}
        className="border border-stone-300 bg-stone-100 px-2 py-1 text-xs font-bold tracking-wide text-stone-600 uppercase"
      >
        {label}
      </td>
    </tr>,
    ...learners.filter((l) => l.sex === sex).map(learnerRow),
  ];

  return (
    <div className="p-6">
      <p className="mb-3 text-sm text-stone-600">
        The {learningArea} term grade is the average of the {ctx.parts.map((p) => p.label).join(" and ")} term grades.
        It shows once every part has scores.
      </p>
      <table className="border-collapse bg-white text-xs">
        <thead className="text-stone-700">
          <tr className="bg-stone-100">
            <th className={`${th} w-8`}>#</th>
            <th className={`${th} text-left`}>Learner&apos;s name</th>
            {ctx.parts.map((p) => (
              <th key={p.id} className={`${th} w-24`}>
                {p.label}
              </th>
            ))}
            <th className={`${th} w-24`}>{learningArea} Term Grade</th>
          </tr>
        </thead>
        <tbody>
          {group("M", "Male")}
          {group("F", "Female")}
        </tbody>
      </table>
      <DescriptorLegend className="mt-3" />
    </div>
  );
}
