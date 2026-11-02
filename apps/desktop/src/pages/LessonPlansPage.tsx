import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "@/app/router";
import { useSchool } from "@/app/school";
import { ConfirmDelete } from "@/components/confirm-delete";
import { EmptyState, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { gradeLabel } from "@/ecr/levels";
import { deleteLessonPlan, listLessonPlans } from "@/lib/db";
import { LessonPlanSettingsButton } from "@/lessons/LessonFooterCard";
import { NewLessonPlanDialog } from "@/lessons/NewLessonPlanDialog";
import type { LessonPlan } from "@/lessons/plan";

const formatDate = (d: string) =>
  new Date(`${d.replace(" ", "T")}Z`).toLocaleDateString("en-PH", { dateStyle: "medium" });

export function LessonPlansPage() {
  const { navigate } = useRouter();
  const { onError } = useSchool();
  const [plans, setPlans] = useState<LessonPlan[] | null>(null);

  const reload = useCallback(() => listLessonPlans().then(setPlans, onError), [onError]);
  useEffect(() => {
    reload();
  }, [reload]);

  const [creating, setCreating] = useState(false);
  const create = () => setCreating(true);

  return (
    <div className="page">
      <PageHeader
        title="Lesson plans"
        description="ILAW lesson plans (DepEd Order No. 16, s. 2026). Draft one with ChatGPT, then review it and download it as a PDF."
        actions={
          <>
            <Button onClick={create}>
              <Plus /> New lesson plan
            </Button>
            <LessonPlanSettingsButton onError={onError} />
          </>
        }
      />

      {plans === null && (
        <div className="mt-6 flex flex-col gap-2" aria-busy aria-label="Loading">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      )}

      {plans && plans.length === 0 && (
        <div className="mt-6">
          <EmptyState title="No lesson plans yet">
            <p>Fill in the lesson details, let ChatGPT draft the parts, then review and save.</p>
            <Button className="mt-4" onClick={create}>
              <Plus /> New lesson plan
            </Button>
          </EmptyState>
        </div>
      )}

      {plans && plans.length > 0 && (
        <Card className="mt-6 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lesson</TableHead>
                <TableHead>Learning area</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Term / week</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => navigate({ page: "lessonPlan", id: p.id })}
                >
                  <TableCell className="font-medium">
                    {p.title || <span className="text-muted-foreground italic">Untitled lesson</span>}
                  </TableCell>
                  <TableCell>{p.learning_area}</TableCell>
                  <TableCell>
                    {gradeLabel(p.grade_level)}
                    {p.sections && <span className="text-muted-foreground"> – {p.sections}</span>}
                  </TableCell>
                  <TableCell>
                    Term {p.term}, Week {p.week}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.updated_at)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <ConfirmDelete
                      title={`Delete “${p.title || "Untitled lesson"}”?`}
                      description="This deletes the lesson plan. This cannot be undone."
                      onConfirm={() => deleteLessonPlan(p.id).then(reload, onError)}
                      trigger={
                        <Button variant="ghost" size="icon-sm" title="Delete">
                          <Trash2 />
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {creating && plans && <NewLessonPlanDialog plans={plans} onOpenChange={setCreating} />}
    </div>
  );
}
