import { Fragment, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteReceived, type ClassRecord, type Learner, type Section } from "@/lib/db";
import { useSchool } from "@/app/school";
import { generalAverage as averageOf, gradeIn, isFailing, useSectionGrades } from "@/ecr/useSectionGrades";
import type { GradeValue } from "./classGrades";
import { DescriptiveLegend } from "./DescriptiveSheet";
import { gradingModeFor } from "./levels";
import { displayName } from "@/lib/names";
import { DescriptorLegend } from "./DescriptorLegend";

type Period = "0" | "1" | "2" | "final";

const formatDate = (s: string) =>
  new Date(s.includes("T") ? s : `${s.replace(" ", "T")}Z`).toLocaleDateString("en-PH", { dateStyle: "medium" });

/** Every learning area's grades for the section, in its subject order: this computer's class records first, then imported files. */
export function SectionGrades({
  section,
  learners,
  localClasses,
  reloadKey,
  onChanged,
  onError,
}: {
  section: Section;
  learners: Learner[];
  localClasses: ClassRecord[];
  /** Changes when grade files are imported, so the table reloads. */
  reloadKey: string;
  onChanged: () => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const [period, setPeriod] = useState<Period>("final");
  const { activeYear } = useSchool();
  const { areas: list, reload } = useSectionGrades(section, learners, localClasses, onError);
  const mode = gradingModeFor(section.grade_level, activeYear?.name ?? "");
  // Descriptive grades have no general average.
  const showAverage = period === "final" && mode === "numeric";

  useEffect(() => {
    reload();
  }, [reloadKey, reload]);

  const areas = list.map((s) => s.area);
  const sources = new Map(list.map((s) => [s.area, s]));
  const ready = list.filter((s) => s.kind !== "missing").length;

  const gradeOf = (area: string, learnerId: number): GradeValue =>
    gradeIn(sources.get(area)!, learnerId, period === "final" ? "final" : (Number(period) as 0 | 1 | 2));

  const generalAverage = (learnerId: number) => averageOf(list, learnerId);

  const groups: ["M" | "F", string][] = [
    ["M", "Male"],
    ["F", "Female"],
  ];
  const failing = isFailing;

  if (mode === "kinder") {
    return (
      <p className="text-sm text-muted-foreground">
        Kindergarten has no learning-area grades. Learners are rated per developmental domain in the Kindergarten class
        record, and the report card prints from there.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {ready} of {areas.length} learning areas available
          {ready < areas.length && " · ask subject teachers to send their grade files"}
        </p>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="0">Term 1</TabsTrigger>
            <TabsTrigger value="1">Term 2</TabsTrigger>
            <TabsTrigger value="2">Term 3</TabsTrigger>
            <TabsTrigger value="final">Final</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="overflow-x-auto py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4 align-bottom">#</TableHead>
              <TableHead className="align-bottom">Learner</TableHead>
              {areas.map((area) => {
                const s = sources.get(area)!;
                return (
                  <TableHead key={area} className="h-auto min-w-24 py-2 text-center align-bottom whitespace-normal">
                    <div className="font-semibold text-foreground">{area}</div>
                    <div className="mt-0.5 text-[11px] font-normal">
                      {s.kind === "local" && <span className="text-primary">Your record</span>}
                      {s.kind === "missing" && <span className="text-amber-700">Not received</span>}
                      {s.kind === "received" && (
                        <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                          <span title={`From ${s.info.teacher_name || "unnamed teacher"}, imported ${formatDate(s.info.imported_at)}`}>
                            {s.info.teacher_name || "Received"} · {formatDate(s.info.exported_at)}
                          </span>
                          <ConfirmDelete
                            title={`Remove imported ${area} grades?`}
                            description={`The grades from ${s.info.teacher_name || "this file"} are removed from ${section.name}. You can import the file again later.`}
                            confirmLabel="Remove"
                            onConfirm={() => deleteReceived(s.info.id).then(async () => { await onChanged(); await reload(); }, onError)}
                            trigger={
                              <Button variant="ghost" size="icon-xs" title="Remove imported grades">
                                <Trash2 />
                              </Button>
                            }
                          />
                        </span>
                      )}
                    </div>
                  </TableHead>
                );
              })}
              {showAverage && <TableHead className="text-center align-bottom">General average</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map(([sex, label]) => (
              <Fragment key={sex}>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableCell
                    colSpan={areas.length + 3}
                    className="pl-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                  >
                    {label}
                  </TableCell>
                </TableRow>
                {learners
                  .filter((l) => l.sex === sex)
                  .map((l, i) => {
                    const ga = showAverage ? generalAverage(l.id) : null;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="pl-4 text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{displayName(l)}</TableCell>
                        {areas.map((area) => {
                          const g = gradeOf(area, l.id);
                          return (
                            <TableCell
                              key={area}
                              className={`text-center tabular-nums ${failing(g) ? "text-destructive" : ""}`}
                            >
                              {g ?? <span className="text-muted-foreground/50">—</span>}
                            </TableCell>
                          );
                        })}
                        {showAverage && (
                          <TableCell className={`text-center font-bold tabular-nums ${failing(ga) ? "text-destructive" : ""}`}>
                            {ga ?? <span className="font-normal text-muted-foreground/50">—</span>}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>
      {mode === "descriptive" ? <DescriptiveLegend className="mt-3" /> : <DescriptorLegend className="mt-3" />}
      <p className="mt-3 text-xs text-muted-foreground">
        General average = average of all final grades, shown once every learning area has a final grade.
      </p>
    </div>
  );
}
