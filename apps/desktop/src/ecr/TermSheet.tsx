import { useEffect, useState, type KeyboardEvent } from "react";
import { scoreKey, type Activity, type Learner } from "@/lib/db";
import { computeTerm, PASSING_GRADE, type Component, type Term } from "@/ecr/grading";
import type { GradingContext } from "./classGrades";
import { displayName } from "@/lib/names";
import { DescriptorLegend } from "./DescriptorLegend";
import { Plus } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";


const fmt = (n: number) => n.toFixed(2);
const EXAMS: [Component, string][] = [
  ["ST1", "ST 1"],
  ["ST2", "ST 2"],
  ["TE", "Term Exam"],
];

/**
 * Moves focus between score cells like a spreadsheet. Left/right only leave
 * the cell when the whole value is selected or the caret is at that edge,
 * so they still move the caret while editing.
 */
function moveFocus(e: KeyboardEvent<HTMLInputElement>, row: number, col: number) {
  const input = e.currentTarget;
  const { selectionStart: start, selectionEnd: end, value } = input;
  const allSelected = start === 0 && end === value.length;
  let dRow = 0;
  let dCol = 0;
  if (e.key === "Enter" || e.key === "ArrowDown") dRow = 1;
  else if (e.key === "ArrowUp") dRow = -1;
  else if (e.key === "ArrowLeft" && (allSelected || (start === 0 && end === 0))) dCol = -1;
  else if (e.key === "ArrowRight" && (allSelected || start === value.length)) dCol = 1;
  if (!dRow && !dCol) return;
  e.preventDefault();
  const next = document.querySelector<HTMLInputElement>(`[data-cell="${row + dRow}:${col + dCol}"]`);
  if (next) {
    next.focus();
    next.select();
  } else if (dRow) {
    input.blur();
  }
}

function NumberCell({
  value,
  max,
  row,
  col,
  onCommit,
  className = "",
}: {
  value: number | undefined;
  max?: number;
  row: number;
  col: number;
  onCommit: (n: number | null) => void;
  className?: string;
}) {
  const [text, setText] = useState(value?.toString() ?? "");
  useEffect(() => setText(value?.toString() ?? ""), [value]);

  const parsed = text.trim() === "" ? null : Number(text);
  const invalid =
    parsed !== null && (Number.isNaN(parsed) || parsed < 0 || (max !== undefined && parsed > max));

  const commit = () => {
    if (invalid || parsed === (value ?? null)) return;
    onCommit(parsed);
  };

  return (
    <input
      data-cell={`${row}:${col}`}
      inputMode="decimal"
      value={text}
      title={invalid ? (max !== undefined ? `Must be 0–${max}` : "Must be a number") : undefined}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setText(value?.toString() ?? "");
          return;
        }
        moveFocus(e, row, col);
      }}
      className={`h-7 w-full bg-transparent px-1 text-center tabular-nums outline-none focus:bg-amber-50 focus:ring-2 focus:ring-inset focus:ring-emerald-600 ${
        invalid ? "bg-red-50 text-red-700 ring-2 ring-inset ring-red-500" : ""
      } ${className}`}
    />
  );
}

export function TermSheet({
  term,
  learners,
  activities,
  scores,
  ctx,
  onScore,
  onHps,
  onAddActivity,
  onDeleteActivity,
}: {
  term: Term;
  learners: Learner[];
  activities: Activity[];
  scores: Map<string, number>;
  ctx: GradingContext;
  onScore: (activityId: number, learnerId: number, score: number | null) => void;
  onHps: (activityId: number, hps: number) => void;
  onAddActivity: (component: "WW" | "PT") => void;
  onDeleteActivity: (activityId: number) => void;
}) {
  const termActs = activities.filter((a) => a.term === term);
  const ww = termActs.filter((a) => a.component === "WW");
  const pt = termActs.filter((a) => a.component === "PT");
  const { weights, exam } = ctx.scheme;
  // Some Senior High subjects have only a term exam, or no Examinations component.
  const exams = EXAMS.filter(([c]) => (exam === "split" ? true : exam === "te" ? c === "TE" : false)).map(([c, label]) => ({
    label,
    act: termActs.find((a) => a.component === c),
  }));
  const hasExam = exams.length > 0;
  const inputCols: Activity[] = [...ww, ...pt, ...exams.flatMap((e) => (e.act ? [e.act] : []))];
  const colOf = (a: Activity) => inputCols.indexOf(a);
  const sumHps = (acts: Activity[]) => acts.reduce((s, a) => s + a.highest_score, 0);

  const ordered = [...learners.filter((l) => l.sex === "M"), ...learners.filter((l) => l.sex === "F")];
  const totalCols = 2 + (ww.length + 3) + (pt.length + 3) + (hasExam ? exams.length + 2 : 0) + 2;

  const th = "border border-stone-300 px-1 py-1 font-semibold";
  const td = "border border-stone-200 p-0";
  const calc = "border border-stone-200 bg-stone-50 px-1.5 text-center tabular-nums text-stone-700";

  const activityHeader = (a: Activity, prefix: string) => {
    const name = `${a.component === "WW" ? "Written Work" : "Performance Task"} ${a.position}`;
    const scored = learners.filter((l) => scores.has(scoreKey(a.id, l.id))).length;
    return (
      <th key={a.id} className={`${th} group relative w-12 min-w-12`}>
        {prefix}
        {a.position}
        <ConfirmDelete
          title={`Delete ${name}?`}
          description={
            scored > 0
              ? `This removes the column and ${scored} learner score(s) in it for Term ${term}. This cannot be undone.`
              : `This removes the column from Term ${term}. No scores have been entered in it yet.`
          }
          confirmLabel="Delete column"
          onConfirm={() => onDeleteActivity(a.id)}
          trigger={
            <button
              type="button"
              title={`Delete ${name}`}
              className="absolute -top-0.5 right-0 text-[10px] leading-none text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              ×
            </button>
          }
        />
      </th>
    );
  };

  const hpsCell = (a: Activity) => (
    <td key={a.id} className={`${td} bg-amber-50/60`}>
      <NumberCell
        value={a.highest_score || undefined}
        row={-1}
        col={colOf(a)}
        className="font-semibold"
        onCommit={(n) => onHps(a.id, n ?? 0)}
      />
    </td>
  );

  let row = 0;
  const learnerRow = (l: Learner, index: number) => {
    const r = row++;
    const scoreOf = (id: number) => scores.get(scoreKey(id, l.id));
    const result = computeTerm(
      termActs.filter((a) => exams.some((e) => e.act?.id === a.id) || a.component === "WW" || a.component === "PT"),
      scoreOf,
      ctx.scheme,
      ctx.transmuted,
    );
    const scoreCell = (a: Activity) => (
      <td key={a.id} className={td}>
        <NumberCell
          value={scoreOf(a.id)}
          max={a.highest_score || undefined}
          row={r}
          col={colOf(a)}
          onCommit={(n) => onScore(a.id, l.id, n)}
        />
      </td>
    );
    const failing = result && result.termGrade < PASSING_GRADE;
    return (
      <tr key={l.id} className="hover:bg-emerald-50/40">
        <td className="sticky left-0 z-10 border border-stone-200 bg-white px-1.5 text-right text-stone-400">
          {index + 1}
        </td>
        <td className="sticky left-8 z-10 min-w-56 border border-stone-200 bg-white px-2 whitespace-nowrap text-stone-800">
          {displayName(l)}
        </td>
        {ww.map(scoreCell)}
        <td className={calc}>{result ? result.WW.raw : ""}</td>
        <td className={calc}>{result ? fmt(result.WW.ps) : ""}</td>
        <td className={calc}>{result ? fmt(result.WW.ws) : ""}</td>
        {pt.map(scoreCell)}
        <td className={calc}>{result ? result.PT.raw : ""}</td>
        <td className={calc}>{result ? fmt(result.PT.ps) : ""}</td>
        <td className={calc}>{result ? fmt(result.PT.ws) : ""}</td>
        {exams.map(({ act, label }) => (act ? scoreCell(act) : <td key={label} className={td} />))}
        {hasExam && <td className={calc}>{result ? fmt(result.EX.ps) : ""}</td>}
        {hasExam && <td className={calc}>{result ? fmt(result.EX.ws) : ""}</td>}
        <td className={`${calc} font-medium`}>{result ? fmt(result.initialGrade) : ""}</td>
        <td
          className={`border border-stone-200 px-1.5 text-center font-bold tabular-nums ${
            failing ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-900"
          }`}
        >
          {result?.termGrade ?? ""}
        </td>
      </tr>
    );
  };

  const groupRow = (label: string) => (
    <tr key={label}>
      <td colSpan={totalCols} className="border border-stone-300 bg-stone-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-stone-600">
        {label}
      </td>
    </tr>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-6 py-2">
        <Button variant="outline" size="sm" onClick={() => onAddActivity("WW")}><Plus /> Written Work</Button>
        <Button variant="outline" size="sm" onClick={() => onAddActivity("PT")}><Plus /> Performance Task</Button>
        <span className="ml-auto text-xs text-stone-500">
          Type scores · Enter / arrow keys to move · Esc to undo · hover a column number to delete it
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <table className="border-collapse bg-white text-xs">
          <thead className="text-stone-700">
            <tr className="bg-stone-100">
              <th rowSpan={2} className={`${th} sticky left-0 z-20 w-8 min-w-8 bg-stone-100`}>#</th>
              <th rowSpan={2} className={`${th} sticky left-8 z-20 bg-stone-100 text-left`}>Learner's name</th>
              <th colSpan={ww.length + 3} className={`${th} bg-sky-100`}>
                Written Works ({weights.WW * 100}%)
              </th>
              <th colSpan={pt.length + 3} className={`${th} bg-violet-100`}>
                Performance Tasks ({weights.PT * 100}%)
              </th>
              {hasExam && (
                <th colSpan={exams.length + 2} className={`${th} bg-amber-100`}>
                  Examinations ({weights.EX * 100}%)
                </th>
              )}
              <th rowSpan={2} className={`${th} w-14`}>Initial Grade</th>
              <th rowSpan={2} className={`${th} w-14`}>Term Grade</th>
            </tr>
            <tr className="bg-stone-50">
              {ww.map((a) => activityHeader(a, ""))}
              <th className={`${th} w-12`}>Total</th>
              <th className={`${th} w-14`}>PS</th>
              <th className={`${th} w-14`}>WS</th>
              {pt.map((a) => activityHeader(a, ""))}
              <th className={`${th} w-12`}>Total</th>
              <th className={`${th} w-14`}>PS</th>
              <th className={`${th} w-14`}>WS</th>
              {exams.map(({ label }) => (
                <th key={label} className={`${th} w-14`}>{label}</th>
              ))}
              {hasExam && <th className={`${th} w-14`}>PS</th>}
              {hasExam && <th className={`${th} w-14`}>WS</th>}
            </tr>
            <tr>
              <td className="sticky left-0 z-10 border border-stone-200 bg-amber-50" />
              <td className="sticky left-8 z-10 border border-stone-200 bg-amber-50 px-2 font-semibold whitespace-nowrap text-amber-900">
                Highest possible score
              </td>
              {ww.map(hpsCell)}
              <td className={calc}>{sumHps(ww)}</td>
              <td className={calc}>100.00</td>
              <td className={calc}>{fmt(weights.WW * 100)}</td>
              {pt.map(hpsCell)}
              <td className={calc}>{sumHps(pt)}</td>
              <td className={calc}>100.00</td>
              <td className={calc}>{fmt(weights.PT * 100)}</td>
              {exams.map(({ act, label }) => (act ? hpsCell(act) : <td key={label} className={td} />))}
              {hasExam && <td className={calc}>100.00</td>}
              {hasExam && <td className={calc}>{fmt(weights.EX * 100)}</td>}
              <td className={calc} />
              <td className={calc} />
            </tr>
          </thead>
          <tbody>
            {groupRow("Male")}
            {ordered.filter((l) => l.sex === "M").map(learnerRow)}
            {groupRow("Female")}
            {ordered.filter((l) => l.sex === "F").map(learnerRow)}
          </tbody>
        </table>
        <DescriptorLegend className="mt-3" />
        {learners.length === 0 && (
          <p className="mt-4 text-sm text-stone-500">No learners in this section yet. Use the Learners button above to add them.</p>
        )}
      </div>
    </div>
  );
}
