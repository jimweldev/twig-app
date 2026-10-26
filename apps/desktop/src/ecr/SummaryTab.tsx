import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Activity, Learner } from "@/lib/db";
import { PASSING_GRADE } from "@/ecr/grading";
import { classGrades, type GradingContext } from "./classGrades";
import { displayName } from "@/lib/names";
import { DescriptorBadge, DescriptorLegend } from "./DescriptorLegend";

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card className="py-3">
      <CardContent>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{children}</div>
      </CardContent>
    </Card>
  );
}

export function SummaryTab({
  learners,
  activities,
  scores,
  ctx,
}: {
  learners: Learner[];
  activities: Activity[];
  scores: Map<string, number>;
  ctx: GradingContext;
}) {
  const grades = classGrades(learners, activities, scores, ctx);
  // Numeric records only, so grades are numbers or null.
  const rows = learners.map((l) => {
    const g = grades.get(l.id)!;
    return { learner: l, terms: ctx.terms.map((t) => g.terms[t - 1] as number | null), final: g.final as number | null };
  });
  const finals = rows.flatMap((r) => (r.final === null ? [] : [r.final]));
  const passed = finals.filter((g) => g >= PASSING_GRADE).length;
  const failing = (g: number | null) => g !== null && g < PASSING_GRADE;

  const groups: ["M" | "F", string][] = [
    ["M", "Male"],
    ["F", "Female"],
  ];

  return (
    <div className="p-6">
      <div className="mb-4 grid grid-cols-3 gap-4">
        <Stat label="Learners">{learners.length}</Stat>
        <Stat label="With final grade">{finals.length}</Stat>
        <Stat label="Passed">
          <span className="text-primary">{passed}</span>
          <span className="text-sm font-normal text-muted-foreground"> / {finals.length}</span>
        </Stat>
      </div>
      <DescriptorLegend className="mb-3" />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">#</TableHead>
              <TableHead>Learner</TableHead>
              {ctx.terms.map((t) => (
                <TableHead key={t} className="text-center">
                  Term {t}
                </TableHead>
              ))}
              <TableHead className="text-center">Final grade</TableHead>
              <TableHead className="text-center">Descriptor</TableHead>
              <TableHead className="text-center">Remarks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map(([sex, label]) => (
              <Fragment key={sex}>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={ctx.terms.length + 5} className="pl-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {label}
                  </TableCell>
                </TableRow>
                {rows
                  .filter((r) => r.learner.sex === sex)
                  .map(({ learner, terms, final }, i) => (
                    <TableRow key={learner.id}>
                      <TableCell className="pl-4 text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{displayName(learner)}</TableCell>
                      {terms.map((g, t) => (
                        <TableCell key={t} className={`text-center tabular-nums ${failing(g) ? "text-destructive" : ""}`}>
                          {g ?? "—"}
                        </TableCell>
                      ))}
                      <TableCell className={`text-center font-bold tabular-nums ${failing(final) ? "text-destructive" : ""}`}>
                        {final ?? "—"}
                      </TableCell>
                      <TableCell className="text-center">{final !== null && <DescriptorBadge grade={final} />}</TableCell>
                      <TableCell className="text-center">
                        {final !== null &&
                          (final >= PASSING_GRADE ? (
                            <Badge>Passed</Badge>
                          ) : (
                            <Badge variant="destructive">Failed</Badge>
                          ))}
                      </TableCell>
                    </TableRow>
                  ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Final grade = average of the term grades{ctx.terms.length < 3 ? " of the terms this subject runs" : ""}, rounded.
        Passing is 75. A final grade appears once every term has scores.
        {!ctx.transmuted && " Zero-based grading: no transmutation; the lowest reported grade is 60."}
      </p>
    </div>
  );
}
