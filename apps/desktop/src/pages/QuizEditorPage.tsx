import { useEffect, useRef, useState } from "react";
import { FileCheck2, FileDown, Info, Loader2, Plus, Save, Undo2, WandSparkles } from "lucide-react";
import { useLeaveGuard, useRouter } from "@/app/router";
import { useSchool } from "@/app/school";
import { Field } from "@/components/field";
import { PageSkeleton } from "@/components/page";
import { GRADE_OPTIONS, SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { areasForGrade } from "@/ecr/levels";
import { getQuiz, listLessonPlans, updateQuiz } from "@/lib/db";
import { PdfRoot, usePdfDownload } from "@/lib/pdf";
import type { LessonPlan } from "@/lessons/plan";
import { PartEditor } from "@/quizzes/PartEditor";
import { QuizAiPanel } from "@/quizzes/QuizAiPanel";
import { QuizDocument, quizPage } from "@/quizzes/QuizDocument";
import {
  PAPERS,
  QUESTION_TYPES,
  TYPE_ORDER,
  newPart,
  quizItems,
  quizPoints,
  type PaperSize,
  type Quiz,
  type QuizContent,
  type QuizPart,
} from "@/quizzes/quiz";
import { toast } from "sonner";

const NONE = "none";

/** Edit a quiz: its tests and items, drafted by ChatGPT or written by hand. Changes are kept until Save. */
export function QuizEditorPage({ id }: { id: number }) {
  const { profile, onError } = useSchool();
  const { navigate } = useRouter();
  const [saved, setSaved] = useState<Quiz | null | undefined>(undefined);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  // The quiz before the last ChatGPT fill, so it can be undone.
  const [beforeFill, setBeforeFill] = useState<Quiz | null>(null);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  // Which document the PDF is being made of.
  const [printing, setPrinting] = useState<"paper" | "key">("paper");
  const pdf = usePdfDownload(onError);
  const opened = useRef(false);

  useEffect(() => {
    getQuiz(id).then((q) => {
      setSaved(q);
      setQuiz(q);
      // A new quiz has no tests yet: start with ChatGPT.
      if (q && !q.content.parts.length && !opened.current) setDrafting(true);
      opened.current = true;
    }, onError);
    listLessonPlans().then(setPlans, onError);
  }, [id, onError]);

  const dirty = !!quiz && !!saved && JSON.stringify(quiz) !== JSON.stringify(saved);

  const save = async () => {
    if (!quiz) return false;
    setSaving(true);
    try {
      const { id: quizId, updated_at: _, ...input } = quiz;
      const next = { ...quiz, title: quiz.title.trim() };
      await updateQuiz(quizId, { ...input, title: next.title });
      setSaved(next);
      setQuiz(next);
      toast.success("Quiz saved");
      return true;
    } catch (e) {
      onError(e);
      return false;
    } finally {
      setSaving(false);
    }
  };

  useLeaveGuard(
    dirty
      ? {
          title: "Save the quiz?",
          description: "You have changes that aren't saved yet.",
          keepLabel: "Save and continue",
          discardLabel: "Discard changes",
          onKeep: async () => {
            if (!(await save())) throw new Error("Not saved");
          },
          onDiscard: () => setQuiz(saved ?? null),
        }
      : null,
  );

  if (saved === undefined) return <PageSkeleton rows={5} />;
  if (saved === null || !quiz) {
    return <p className="p-8 text-sm text-muted-foreground">This quiz was deleted.</p>;
  }

  const plan = plans.find((p) => p.id === quiz.lesson_plan_id) ?? null;
  const edit = (patch: Partial<Quiz>) => setQuiz({ ...quiz, ...patch });
  const editContent = (patch: Partial<QuizContent>) => edit({ content: { ...quiz.content, ...patch } });
  const parts = quiz.content.parts;
  const setParts = (next: QuizPart[]) => editContent({ parts: next });

  const applyAi = (title: string, generated: QuizPart[], mode: "replace" | "add") => {
    setBeforeFill(quiz);
    setQuiz({
      ...quiz,
      title: quiz.title.trim() || title,
      content: { ...quiz.content, parts: mode === "add" ? [...parts, ...generated] : generated },
    });
    setDrafting(false);
    toast.success(`${generated.length} test${generated.length === 1 ? "" : "s"} filled in`, {
      description: "Check every item and its answer before printing.",
    });
  };

  const move = (i: number, by: -1 | 1) => {
    const next = [...parts];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setParts(next);
  };

  const download = (doc: "paper" | "key") => {
    setPrinting(doc);
    const name = quiz.title.trim() || "Quiz";
    pdf.download(doc === "key" ? `${name} - Answer key` : name, quizPage(quiz));
  };

  const items = quizItems(quiz.content);
  const points = quizPoints(quiz.content);

  return (
    <div className="page flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{quiz.title || "Untitled quiz"}</h1>
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        {beforeFill && (
          <Button variant="ghost" onClick={() => (setQuiz(beforeFill), setBeforeFill(null))}>
            <Undo2 /> Undo fill
          </Button>
        )}
        <Button variant="outline" onClick={() => setDrafting(true)}>
          <WandSparkles /> Generate with ChatGPT
        </Button>
        <Button variant="outline" disabled={pdf.downloading || !items} onClick={() => download("paper")}>
          {pdf.downloading && printing === "paper" ? <Loader2 className="animate-spin" /> : <FileDown />} Test paper
        </Button>
        <Button variant="outline" disabled={pdf.downloading || !items} onClick={() => download("key")}>
          {pdf.downloading && printing === "key" ? <Loader2 className="animate-spin" /> : <FileCheck2 />} Answer key
        </Button>
        <Button disabled={!dirty || saving} onClick={save}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />} Save
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quiz details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Quiz title" className="sm:col-span-2">
            <Input
              placeholder="e.g. Quiz 1: Geologic Time Scale"
              value={quiz.title}
              onChange={(e) => edit({ title: e.target.value })}
            />
          </Field>
          <Field label="From lesson plan" className="sm:col-span-2">
            <SimpleSelect
              value={quiz.lesson_plan_id === null ? NONE : String(quiz.lesson_plan_id)}
              onValueChange={(v) => edit({ lesson_plan_id: v === NONE ? null : Number(v) })}
              options={[
                { value: NONE, label: "None" },
                ...plans.map((p) => ({
                  value: String(p.id),
                  label: `${p.title || "Untitled lesson"} (Term ${p.term}, Week ${p.week})`,
                })),
              ]}
            />
          </Field>
          <Field label="Grade level">
            <SimpleSelect
              value={String(quiz.grade_level)}
              onValueChange={(v) => edit({ grade_level: Number(v) })}
              options={GRADE_OPTIONS}
            />
          </Field>
          <Field label="Learning area">
            <SimpleSelect
              creatable
              placeholder="Choose or type…"
              value={quiz.learning_area}
              onValueChange={(v) => edit({ learning_area: v })}
              options={areasForGrade(quiz.grade_level).map((a) => ({ value: a.name, label: a.name }))}
            />
          </Field>
          <Field label="Paper size" className="sm:col-span-2">
            <SimpleSelect
              value={quiz.content.paper ?? "short"}
              onValueChange={(v) => editContent({ paper: v as PaperSize })}
              options={Object.entries(PAPERS).map(([value, p]) => ({ value, label: p.label }))}
            />
          </Field>
          <Field
            label="General instructions"
            className="sm:col-span-2 lg:col-span-4"
            hint="Printed above Test I. Leave blank if each test's directions are enough."
          >
            <Textarea
              rows={1}
              placeholder="e.g. Read each item carefully. Use a black or blue pen. Erasures are considered wrong."
              value={quiz.content.instructions ?? ""}
              onChange={(e) => editContent({ instructions: e.target.value })}
            />
          </Field>
        </CardContent>
      </Card>

      {parts.length > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Info className="size-3.5" />
          {parts.length} test{parts.length === 1 ? "" : "s"} · {items} item{items === 1 ? "" : "s"} · {points} point
          {points === 1 ? "" : "s"}
        </p>
      )}

      {parts.map((part, i) => (
        <PartEditor
          key={i}
          part={part}
          index={i}
          count={parts.length}
          onChange={(p) => setParts(parts.map((x, j) => (j === i ? p : x)))}
          onRemove={() => setParts(parts.filter((_, j) => j !== i))}
          onMove={(by) => move(i, by)}
        />
      ))}

      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-medium">Add a test:</span>
          {TYPE_ORDER.map((t) => (
            <Button key={t} variant="outline" size="sm" onClick={() => setParts([...parts, newPart(t)])}>
              <Plus /> {QUESTION_TYPES[t].label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Dialog open={drafting} onOpenChange={setDrafting}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Generate with ChatGPT</DialogTitle>
            <DialogDescription>
              {plan ? (
                <>
                  Written from your lesson plan{" "}
                  <button className="underline" onClick={() => navigate({ page: "lessonPlan", id: plan.id })}>
                    {plan.title || "Untitled lesson"}
                  </button>
                  . Review every item and answer before printing.
                </>
              ) : (
                "Review every item and answer before printing."
              )}
            </DialogDescription>
          </DialogHeader>
          <QuizAiPanel quiz={quiz} plan={plan} onApply={applyAi} />
        </DialogContent>
      </Dialog>

      <PdfRoot page={pdf.page}>
        <QuizDocument quiz={quiz} profile={profile} answers={printing === "key"} />
      </PdfRoot>
    </div>
  );
}
