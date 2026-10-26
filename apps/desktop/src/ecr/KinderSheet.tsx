import { Fragment, useState } from "react";
import { useSchool } from "@/app/school";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ClassRecord, Learner } from "@/lib/db";
import { displayName } from "@/lib/names";
import { TERMS } from "./grading";
import { KINDER_CODES, KINDER_DOMAINS } from "./levels";
import { useDescriptiveRatings } from "./useDescriptiveRatings";

export const KINDER_COLORS: Record<string, string> = {
  CO: "bg-emerald-100 text-emerald-800",
  DV: "bg-amber-100 text-amber-800",
  BG: "bg-red-100 text-red-800",
};

export function KinderLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground ${className}`}>
      <span className="font-medium text-foreground">Ratings:</span>
      {KINDER_CODES.map((k) => (
        <span key={k.code} className="flex items-center gap-1.5">
          <span className={`rounded px-1.5 font-bold ${KINDER_COLORS[k.code]}`}>{k.code}</span> {k.name}
        </span>
      ))}
    </div>
  );
}

/** Kindergarten progress: CO / DV / BG per developmental domain, per term. */
export function KinderSheet({ classRecord, learners }: { classRecord: ClassRecord; learners: Learner[] }) {
  const { onError } = useSchool();
  const [term, setTerm] = useState(1);
  const { loading, codeOf, setCode } = useDescriptiveRatings(classRecord.id, onError);
  const groups: ["M" | "F", string][] = [
    ["M", "Male"],
    ["F", "Female"],
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b bg-background px-6 py-2">
        <Tabs value={String(term)} onValueChange={(v) => setTerm(Number(v))}>
          <TabsList>
            {TERMS.map((t) => (
              <TabsTrigger key={t} value={String(t)}>
                Term {t}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <KinderLegend />
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
          Kindergarten is assessed as one integrated record across developmental domains, not by learning area. Rate
          each learner per domain from your observations.
        </p>
        {!loading && (
          <Card className="w-fit max-w-full overflow-x-auto py-0">
            <table className="border-collapse bg-white text-sm">
              <thead>
                <tr className="bg-stone-50 text-[11px] text-stone-700">
                  <th className="w-8 border border-stone-200">#</th>
                  <th className="min-w-56 border border-stone-200 px-2 text-left text-xs">Learner</th>
                  {KINDER_DOMAINS.map((d) => (
                    <th key={d.key} className="w-28 border border-stone-200 px-1.5 py-1.5 font-medium leading-tight">
                      {d.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(([sex, label]) => (
                  <Fragment key={sex}>
                    <tr>
                      <td colSpan={KINDER_DOMAINS.length + 2} className="border border-stone-200 bg-stone-100 px-2 py-1 text-xs font-bold tracking-wide text-stone-600 uppercase">
                        {label}
                      </td>
                    </tr>
                    {learners
                      .filter((l) => l.sex === sex)
                      .map((l, i) => (
                        <tr key={l.id}>
                          <td className="border border-stone-200 px-1.5 text-right text-xs text-stone-400">{i + 1}</td>
                          <td className="border border-stone-200 px-2 whitespace-nowrap">{displayName(l)}</td>
                          {KINDER_DOMAINS.map((d) => {
                            const code = codeOf(l.id, term, d.key);
                            return (
                              <td key={d.key} className={`border border-stone-200 p-0 ${code ? KINDER_COLORS[code] : ""}`}>
                                <select
                                  aria-label={`${displayName(l)} ${d.name} term ${term}`}
                                  value={code ?? ""}
                                  onChange={(e) => setCode(l.id, term, d.key, e.target.value || null)}
                                  className="h-8 w-full cursor-pointer bg-transparent text-center font-bold outline-none focus:ring-2 focus:ring-primary focus:ring-inset"
                                >
                                  <option value="">—</option>
                                  {KINDER_CODES.map((k) => (
                                    <option key={k.code} value={k.code}>
                                      {k.code} – {k.name}
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
