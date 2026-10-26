import { Fragment, useState } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Learner, Marking } from "@/lib/db";
import { displayName } from "@/lib/names";
import { TERMS } from "./grading";
import { BEHAVIORS, CORE_VALUES, MARKINGS, type useObservedValues } from "./observedValues";

// Clicking a cell cycles blank → AO → SO → RO → NO → blank.
const CYCLE: (Marking | null)[] = [null, "AO", "SO", "RO", "NO"];
const COLOR: Record<Marking, string> = {
  AO: "bg-emerald-100 text-emerald-800",
  SO: "bg-sky-100 text-sky-800",
  RO: "bg-amber-100 text-amber-800",
  NO: "bg-red-100 text-red-800",
};

/** Encodes the SF9 observed values of an advisory class, one term at a time. */
export function ObservedValuesGrid({
  learners,
  values,
}: {
  learners: Learner[];
  /** Shared with the report card preview so markings show there right away. */
  values: ReturnType<typeof useObservedValues>;
}) {
  const [term, setTerm] = useState(1);
  const [filling, setFilling] = useState(false);
  const { loading, markingOf, setMarking } = values;

  const blanks = learners.flatMap((l) =>
    BEHAVIORS.filter((b) => !markingOf(l.id, term, b.key)).map((b) => [l.id, b.key] as const),
  );

  const fillBlanks = async () => {
    setFilling(true);
    for (const [learnerId, behavior] of blanks) await setMarking(learnerId, term, behavior, "AO");
    setFilling(false);
  };

  const cell = "h-8 min-w-12 border border-stone-200 p-0 text-center text-xs";
  const groups: ["M" | "F", string][] = [
    ["M", "Male"],
    ["F", "Female"],
  ];
  let n = 0;

  if (loading) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={String(term)} onValueChange={(v) => setTerm(Number(v))}>
          <TabsList>
            {TERMS.map((t) => (
              <TabsTrigger key={t} value={String(t)}>
                Term {t}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" disabled={blanks.length === 0 || filling} onClick={fillBlanks}>
          <CheckCheck /> Fill {blanks.length || ""} blank{blanks.length === 1 ? "" : "s"} with AO
        </Button>
        <div className="ml-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
          {MARKINGS.map((m) => (
            <span key={m.code} className="flex items-center gap-1">
              <span className={`rounded px-1 font-bold ${COLOR[m.code]}`}>{m.code}</span> {m.label}
            </span>
          ))}
        </div>
      </div>

      <Card className="overflow-x-auto py-0">
        <table className="border-collapse bg-white text-sm">
          <thead className="text-stone-700">
            <tr className="bg-stone-50">
              <th rowSpan={2} className="sticky left-0 z-20 w-8 min-w-8 border border-stone-200 bg-stone-50 text-xs">
                #
              </th>
              <th rowSpan={2} className="sticky left-8 z-20 min-w-56 border border-stone-200 bg-stone-50 px-2 text-left text-xs">
                Learner
              </th>
              {CORE_VALUES.map((v) => (
                <th key={v.name} colSpan={v.behaviors.length} className="border border-stone-200 px-2 py-1 text-xs">
                  {v.name}
                </th>
              ))}
            </tr>
            <tr className="bg-stone-50">
              {CORE_VALUES.flatMap((v) =>
                v.behaviors.map((b, i) => (
                  <th key={b.key} title={b.text} className="border border-stone-200 px-1 py-1 text-[11px] font-medium">
                    {i + 1}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {groups.map(([sex, label]) => (
              <Fragment key={sex}>
                <tr>
                  <td
                    colSpan={BEHAVIORS.length + 2}
                    className="border border-stone-200 bg-stone-100 px-2 py-1 text-xs font-bold tracking-wide text-stone-600 uppercase"
                  >
                    {label}
                  </td>
                </tr>
                {learners
                  .filter((l) => l.sex === sex)
                  .map((l) => (
                    <tr key={l.id} className="hover:bg-emerald-50/40">
                      <td className="sticky left-0 z-10 border border-stone-200 bg-white px-1.5 text-right text-xs text-stone-400">
                        {++n}
                      </td>
                      <td className="sticky left-8 z-10 border border-stone-200 bg-white px-2 whitespace-nowrap">
                        {displayName(l)}
                      </td>
                      {BEHAVIORS.map((b) => {
                        const m = markingOf(l.id, term, b.key);
                        const next = CYCLE[(CYCLE.indexOf(m ?? null) + 1) % CYCLE.length];
                        return (
                          <td key={b.key} className={cell}>
                            <button
                              type="button"
                              title={b.text}
                              onClick={() => setMarking(l.id, term, b.key, next)}
                              className={`h-full w-full font-bold ${m ? COLOR[m] : "hover:bg-emerald-50"}`}
                            >
                              {m ?? ""}
                            </button>
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

      <ol className="mt-4 grid gap-x-8 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        {CORE_VALUES.map((v) =>
          v.behaviors.map((b, i) => (
            <li key={b.key}>
              <span className="font-medium text-foreground">
                {v.name} {i + 1}:
              </span>{" "}
              {b.text}
            </li>
          )),
        )}
      </ol>
    </div>
  );
}
