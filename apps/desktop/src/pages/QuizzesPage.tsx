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
import { deleteQuiz, listLessonPlans, listQuizzes } from "@/lib/db";
import type { LessonPlan } from "@/lessons/plan";
import { NewQuizDialog } from "@/quizzes/NewQuizDialog";
import { QUESTION_TYPES, quizItems, quizPoints, type Quiz } from "@/quizzes/quiz";

const formatDate = (d: string) =>
  new Date(`${d.replace(" ", "T")}Z`).toLocaleDateString("en-PH", { dateStyle: "medium" });

export function QuizzesPage() {
  const { navigate } = useRouter();
  const { onError } = useSchool();
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const [plans, setPlans] = useState<LessonPlan[] | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(() => listQuizzes().then(setQuizzes, onError), [onError]);
  useEffect(() => {
    reload();
    listLessonPlans().then(setPlans, onError);
  }, [reload, onError]);

  const create = () => setCreating(true);
  const planTitle = (id: number | null) => plans?.find((p) => p.id === id)?.title;

  return (
    <div className="page">
      <PageHeader
        title="Quizzes"
        description="Quizzes and tests made from your lesson plans: multiple choice, true or false, identification, matching, enumeration and essay. Download the test paper and its answer key as PDFs."
        actions={
          <Button onClick={create}>
            <Plus /> New quiz
          </Button>
        }
      />

      {quizzes === null && (
        <div className="mt-6 flex flex-col gap-2" aria-busy aria-label="Loading">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      )}

      {quizzes && quizzes.length === 0 && (
        <div className="mt-6">
          <EmptyState title="No quizzes yet">
            <p>Pick a lesson plan, choose the kinds of test, and let ChatGPT write the items for you to review.</p>
            <Button className="mt-4" onClick={create}>
              <Plus /> New quiz
            </Button>
          </EmptyState>
        </div>
      )}

      {quizzes && quizzes.length > 0 && (
        <Card className="mt-6 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quiz</TableHead>
                <TableHead>Learning area</TableHead>
                <TableHead>Tests</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {quizzes.map((q) => (
                <TableRow key={q.id} className="cursor-pointer" onClick={() => navigate({ page: "quiz", id: q.id })}>
                  <TableCell>
                    <div className="font-medium">
                      {q.title || <span className="text-muted-foreground italic">Untitled quiz</span>}
                    </div>
                    {planTitle(q.lesson_plan_id) && (
                      <div className="text-xs text-muted-foreground">From: {planTitle(q.lesson_plan_id)}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {q.learning_area} <span className="text-muted-foreground">– {gradeLabel(q.grade_level)}</span>
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">
                    {q.content.parts.map((p) => QUESTION_TYPES[p.type].label).join(", ") || "None yet"}
                  </TableCell>
                  <TableCell>
                    {quizItems(q.content)} <span className="text-muted-foreground">({quizPoints(q.content)} pts)</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(q.updated_at)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <ConfirmDelete
                      title={`Delete “${q.title || "Untitled quiz"}”?`}
                      description="This deletes the quiz and its answer key. This cannot be undone."
                      onConfirm={() => deleteQuiz(q.id).then(reload, onError)}
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
      {creating && quizzes && plans && <NewQuizDialog plans={plans} quizzes={quizzes} onOpenChange={setCreating} />}
    </div>
  );
}
