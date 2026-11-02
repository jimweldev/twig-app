import { useState } from "react";
import { useRouter } from "@/app/router";
import { useSchool } from "@/app/school";
import { Field } from "@/components/field";
import { GRADE_OPTIONS, SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { areasForGrade, gradeLabel } from "@/ecr/levels";
import { createQuiz } from "@/lib/db";
import type { LessonPlan } from "@/lessons/plan";
import type { Quiz } from "./quiz";

const NONE = "none";

/** Creates a quiz from a lesson plan: same topic, grade and learning area. Opens it to be generated. */
export async function createQuizFromPlan(plan: LessonPlan): Promise<number> {
  return createQuiz({
    title: plan.title ? `${plan.title} Quiz` : "",
    lesson_plan_id: plan.id,
    grade_level: plan.grade_level,
    learning_area: plan.learning_area,
    content: { parts: [] },
  });
}

/** A new quiz: from one of the teacher's lesson plans, or from scratch. */
export function NewQuizDialog({
  plans,
  quizzes,
  onOpenChange,
}: {
  /** The teacher's lesson plans, newest first. */
  plans: LessonPlan[];
  /** The teacher's quizzes, newest first; a blank quiz starts from the latest one's grade and subject. */
  quizzes: Quiz[];
  onOpenChange: (open: boolean) => void;
}) {
  const { navigate } = useRouter();
  const { onError } = useSchool();
  const [planId, setPlanId] = useState(plans[0] ? String(plans[0].id) : NONE);
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState(quizzes[0]?.grade_level ?? 7);
  const [area, setArea] = useState(quizzes[0]?.learning_area ?? "");
  const [busy, setBusy] = useState(false);
  const plan = plans.find((p) => String(p.id) === planId) ?? null;

  const create = async () => {
    setBusy(true);
    try {
      const id = plan
        ? await createQuizFromPlan(plan)
        : await createQuiz({
            title: title.trim(),
            lesson_plan_id: null,
            grade_level: grade,
            learning_area: area.trim(),
            content: { parts: [] },
          });
      onOpenChange(false);
      navigate({ page: "quiz", id });
    } catch (e) {
      onError(e);
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New quiz</DialogTitle>
          <DialogDescription>
            From a lesson plan, ChatGPT writes the items from what the lesson taught. You choose the kinds of test next.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="From lesson plan">
            <SimpleSelect
              value={planId}
              onValueChange={setPlanId}
              options={[
                ...plans.map((p) => ({
                  value: String(p.id),
                  label: `${p.title || "Untitled lesson"} (${gradeLabel(p.grade_level)} ${p.learning_area}, Term ${p.term} Week ${p.week})`,
                })),
                { value: NONE, label: "None: start a blank quiz" },
              ]}
            />
          </Field>
          {!plan && (
            <>
              <Field label="Quiz title" required>
                <Input
                  autoFocus
                  placeholder="e.g. Quiz 1: Parts of a plant"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Grade level">
                  <SimpleSelect
                    value={String(grade)}
                    onValueChange={(v) => setGrade(Number(v))}
                    options={GRADE_OPTIONS}
                  />
                </Field>
                <Field label="Learning area">
                  <SimpleSelect
                    creatable
                    placeholder="Choose or type…"
                    value={area}
                    onValueChange={setArea}
                    options={areasForGrade(grade).map((a) => ({ value: a.name, label: a.name }))}
                  />
                </Field>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy || (!plan && !title.trim())} onClick={create}>
            Create quiz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
