import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "@/app/router";
import { useSchool } from "@/app/school";
import { ConfirmDelete } from "@/components/confirm-delete";
import { EmptyState, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { gradeLabel } from "@/ecr/levels";
import { createLessonPlan, deleteLessonPlan, listLessonPlans } from "@/lib/db";
import type { LessonPlan } from "@/lessons/plan";

const formatDate = (d: string) =>
  new Date(`${d.replace(" ", "T")}Z`).toLocaleDateString("en-PH", { dateStyle: "medium" });

export function LessonPlansPage() {
  const { navigate } = useRouter();
  const { sections, classes, onError } = useSchool();
  const [plans, setPlans] = useState<LessonPlan[] | null>(null);

  const reload = useCallback(() => listLessonPlans().then(setPlans, onError), [onError]);
  useEffect(() => {
    reload();
  }, [reload]);

  // Start from the teacher's most recent plan, else their first class, so the details are usually right already.
  const create = async () => {
    const last = plans?.[0];
    const firstClass = classes[0];
    const section = firstClass ? sections.find((s) => s.id === firstClass.section_id) : sections[0];
    try {
      const id = await createLessonPlan({
        title: "",
        grade_level: last?.grade_level ?? section?.grade_level ?? 7,
        learning_area: last?.learning_area ?? firstClass?.learning_area ?? "",
        sections: last?.sections ?? section?.name ?? "",
        term: last?.term ?? 1,
        week: last ? last.week + 1 : 1,
        sessions: last?.sessions ?? 1,
        minutes: last?.minutes ?? 60,
        content: {},
      });
      navigate({ page: "lessonPlan", id });
    } catch (e) {
      onError(e);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-8">
      <PageHeader
        title="Lesson plans"
        description="ILAW lesson plans (DepEd Order No. 16, s. 2026). Draft one with ChatGPT, then review it and print."
        actions={
          <Button onClick={create}>
            <Plus /> New lesson plan
          </Button>
        }
      />

      {plans && plans.length === 0 && (
        <div className="mt-6">
          <EmptyState title="No lesson plans yet">
            <p>Create one, fill in the lesson details, and let ChatGPT draft the parts for you to review.</p>
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
    </div>
  );
}
