import { useEffect, useState } from "react";
import { PageSkeleton } from "@/components/page";
import { FileDown, ListChecks, Loader2, Save, Undo2, WandSparkles } from "lucide-react";
import { useLeaveGuard, useRouter } from "@/app/router";
import { useSchool } from "@/app/school";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/rich-text-editor";
import { hasText } from "@/lib/rich-text";
import { getLessonFooter, getLessonPlan, updateLessonPlan, type LessonFooter } from "@/lib/db";
import { PdfRoot, usePdfDownload } from "@/lib/pdf";
import { AiDraftPanel } from "@/lessons/AiDraftPanel";
import { createQuizFromPlan } from "@/quizzes/NewQuizDialog";
import { LessonDetailsFields } from "@/lessons/LessonDetailsFields";
import { LessonFooterCard } from "@/lessons/LessonFooterCard";
import { LessonPlanDocument, PLAN_PAGE } from "@/lessons/LessonPlanDocument";
import {
  PARTS,
  SECTIONS,
  cleanContent,
  sessionText,
  withAiValues,
  withSessionText,
  type AiValues,
  type LessonPlan,
  type PlanContent,
} from "@/lessons/plan";
import { toast } from "sonner";

/** Edit an ILAW lesson plan. Changes are kept until Save. */
export function LessonPlanEditorPage({ id }: { id: number }) {
  const { profile, onError } = useSchool();
  const { navigate } = useRouter();
  const [saved, setSaved] = useState<LessonPlan | null | undefined>(undefined);
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  // The plan before the last ChatGPT fill, so it can be undone.
  const [beforeFill, setBeforeFill] = useState<LessonPlan | null>(null);
  const [saving, setSaving] = useState(false);
  // The ChatGPT panel, opened only to redraft a plan that's already filled in.
  const [redrafting, setRedrafting] = useState(false);
  const pdf = usePdfDownload(onError);
  // The default footer, for plans without one of their own.
  const [defaultFooter, setDefaultFooter] = useState<LessonFooter>({ left: [], right: [] });

  useEffect(() => {
    getLessonFooter().then(setDefaultFooter, onError);
  }, [onError]);

  useEffect(() => {
    getLessonPlan(id).then((p) => {
      // Older ChatGPT replies left "\n" as text; show and save them as real line breaks.
      const clean = p && { ...p, content: cleanContent(p.content) };
      setSaved(clean);
      setPlan(clean);
    }, onError);
  }, [id, onError]);

  const dirty = !!plan && !!saved && JSON.stringify(plan) !== JSON.stringify(saved);
  const titleMissing = !!plan && !plan.title.trim();

  const save = async () => {
    if (!plan || titleMissing) return false;
    setSaving(true);
    try {
      const { id: planId, updated_at: _, ...input } = plan;
      const next = { ...plan, title: plan.title.trim() };
      await updateLessonPlan(planId, { ...input, title: next.title });
      setSaved(next);
      setPlan(next);
      toast.success("Lesson plan saved");
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
          title: "Save the lesson plan?",
          description: "You have changes that aren't saved yet.",
          keepLabel: "Save and continue",
          discardLabel: "Discard changes",
          onKeep: async () => {
            if (!(await save())) throw new Error("Not saved");
          },
          onDiscard: () => setPlan(saved ?? null),
        }
      : null,
  );

  if (saved === undefined) return <PageSkeleton rows={5} />;
  if (saved === null || !plan) {
    return <p className="p-8 text-sm text-muted-foreground">This lesson plan was deleted.</p>;
  }

  const edit = (patch: Partial<LessonPlan>) => setPlan({ ...plan, ...patch });
  const editContent = (patch: PlanContent) => edit({ content: { ...plan.content, ...patch } });

  const applyAi = (values: AiValues) => {
    setBeforeFill(plan);
    setPlan({
      ...plan,
      content: withAiValues(plan.content, values, plan.content.prepared_by || profile?.teacher_name),
    });
    setRedrafting(false);
  };
  const undoFill = () => {
    if (!beforeFill) return;
    setPlan(beforeFill);
    setBeforeFill(null);
  };

  return (
    <div className="page flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{plan.title || "Untitled lesson"}</h1>
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        {beforeFill && (
          <Button variant="ghost" onClick={undoFill} title="Put back the plan as it was before the last ChatGPT fill">
            <Undo2 /> Undo regenerate
          </Button>
        )}
        <Button variant="outline" onClick={() => setRedrafting(true)}>
          <WandSparkles /> Regenerate with ChatGPT
        </Button>
        <Button
          variant="outline"
          title="A new quiz on what this lesson taught"
          onClick={() => createQuizFromPlan(saved).then((quizId) => navigate({ page: "quiz", id: quizId }), onError)}
        >
          <ListChecks /> Make a quiz
        </Button>
        <Button
          variant="outline"
          disabled={pdf.downloading}
          onClick={() => pdf.download(`Lesson plan - ${plan.title || "Untitled"}`, PLAN_PAGE)}
        >
          {pdf.downloading ? <Loader2 className="animate-spin" /> : <FileDown />} Download PDF
        </Button>
        <Button disabled={!dirty || titleMissing || saving} onClick={save}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />} Save
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lesson details</CardTitle>
        </CardHeader>
        <CardContent>
          <LessonDetailsFields value={plan} onChange={edit} titleError={titleMissing} />
        </CardContent>
      </Card>

      <Dialog open={redrafting} onOpenChange={setRedrafting}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Regenerate with ChatGPT</DialogTitle>
          </DialogHeader>
          <AiDraftPanel plan={plan} onApply={applyAi} />
        </DialogContent>
      </Dialog>

      {PARTS.map((part) => (
        <Card key={part.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">
                {part.id}
              </span>
              {part.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {SECTIONS.filter((s) => s.part === part.id).map((s) =>
              s.perSession ? (
                <Field key={s.key} label={s.label} hint={s.hint}>
                  <div className="flex flex-col gap-2">
                    {hasText(plan.content[s.key]) && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                          All sessions (prints across every column). Clear it to use the session boxes.
                        </span>
                        <RichTextEditor
                          value={plan.content[s.key]}
                          onChange={(html) => editContent({ [s.key]: html })}
                        />
                      </div>
                    )}
                    <div
                      className="grid gap-2"
                      style={{ gridTemplateColumns: `repeat(${Math.min(plan.sessions, 4)}, minmax(0, 1fr))` }}
                    >
                      {Array.from({ length: plan.sessions }, (_, i) => (
                        <div key={i} className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground">Session {i + 1}</span>
                          <RichTextEditor
                            className="h-full"
                            disabled={hasText(plan.content[s.key])}
                            value={sessionText(plan.content, s.key, i)}
                            onChange={(html) => edit({ content: withSessionText(plan.content, s.key, i, html) })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </Field>
              ) : (
                <Field key={s.key} label={s.label} hint={s.hint}>
                  <RichTextEditor value={plan.content[s.key]} onChange={(html) => editContent({ [s.key]: html })} />
                </Field>
              ),
            )}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>References and AI use</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="References" hint="Books, curriculum guides, websites and toolkits, one per line">
            <RichTextEditor value={plan.content.references} onChange={(html) => editContent({ references: html })} />
          </Field>
          <div className="flex flex-col gap-1.5">
            <Label>Declaration of AI use</Label>
            <RichTextEditor
              value={plan.content.ai_declaration}
              onChange={(html) => editContent({ ai_declaration: html })}
            />
            <p className="text-xs text-muted-foreground">
              Filled in for you when ChatGPT drafts this plan. Say which tool helped and how you checked its work.
            </p>
          </div>
        </CardContent>
      </Card>

      <LessonFooterCard
        own={plan.content.footer}
        fallback={defaultFooter}
        onChange={(footer) => editContent({ footer })}
        onError={onError}
      />

      <PdfRoot page={pdf.page}>
        <LessonPlanDocument plan={plan} profile={profile} footer={plan.content.footer ?? defaultFooter} />
      </PdfRoot>
    </div>
  );
}
