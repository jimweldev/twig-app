import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Printer } from "lucide-react";
import { useSchool } from "@/app/school";
import { Field } from "@/components/field";
import { GRADE_OPTIONS, SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { areasForGrade } from "@/ecr/levels";
import { getLessonPlan, updateLessonPlan } from "@/lib/db";
import { AiDraftPanel } from "@/lessons/AiDraftPanel";
import { LessonPlanDocument } from "@/lessons/LessonPlanDocument";
import { DEFAULT_AI_DECLARATION, PARTS, SECTIONS, type AiKey, type LessonPlan, type PlanContent } from "@/lessons/plan";

const SAVE_DELAY_MS = 500;

/** A whole number from a number box, kept within range. */
const whole = (text: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(text) || min)));

/** Write or draft an ILAW lesson plan. Changes save as you type. */
export function LessonPlanEditorPage({ id }: { id: number }) {
  const { profile, onError } = useSchool();
  const [plan, setPlan] = useState<LessonPlan | null | undefined>(undefined);
  const [saving, setSaving] = useState<"idle" | "pending" | "saved">("idle");
  // The plan before the last ChatGPT fill, so it can be undone.
  const [beforeFill, setBeforeFill] = useState<LessonPlan | null>(null);
  const [printing, setPrinting] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    getLessonPlan(id).then(setPlan, onError);
  }, [id, onError]);

  useEffect(() => {
    if (!plan || !dirty.current) return;
    setSaving("pending");
    const t = setTimeout(() => {
      dirty.current = false;
      const { id: planId, updated_at: _, ...input } = plan;
      updateLessonPlan(planId, input).then(() => setSaving("saved"), onError);
    }, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [plan, onError]);

  // Print the plan from a print-only root, then remove it.
  useEffect(() => {
    if (!printing) return;
    const t = setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 50);
    return () => clearTimeout(t);
  }, [printing]);

  if (plan === undefined) return null;
  if (plan === null) return <p className="p-8 text-sm text-muted-foreground">This lesson plan was deleted.</p>;

  const edit = (patch: Partial<LessonPlan>) => {
    dirty.current = true;
    setPlan({ ...plan, ...patch });
  };
  const editContent = (patch: PlanContent) => edit({ content: { ...plan.content, ...patch } });

  const applyAi = (values: Partial<Record<AiKey, string>>) => {
    const { title, ...content } = values;
    setBeforeFill(plan);
    edit({
      title: title ?? plan.title,
      content: {
        ...plan.content,
        ...content,
        ai_declaration: plan.content.ai_declaration?.trim() ? plan.content.ai_declaration : DEFAULT_AI_DECLARATION,
      },
    });
  };
  const undoFill = () => {
    if (!beforeFill) return;
    dirty.current = true;
    setPlan(beforeFill);
    setBeforeFill(null);
  };

  const areaListId = `areas-${plan.id}`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label="Lesson title"
          placeholder="Lesson title"
          className="h-9 max-w-xl flex-1 text-lg font-semibold"
          value={plan.title}
          onChange={(e) => edit({ title: e.target.value })}
        />
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {saving === "pending" && (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Saving…
            </>
          )}
          {saving === "saved" && (
            <>
              <Check className="size-3.5" /> Saved
            </>
          )}
        </span>
        <Button className="ml-auto" onClick={() => setPrinting(true)}>
          <Printer /> Print
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lesson details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Grade level">
            <SimpleSelect
              value={String(plan.grade_level)}
              onValueChange={(v) => edit({ grade_level: Number(v) })}
              options={GRADE_OPTIONS}
            />
          </Field>
          <Field label="Learning area">
            <Input
              list={areaListId}
              value={plan.learning_area}
              onChange={(e) => edit({ learning_area: e.target.value })}
            />
          </Field>
          <datalist id={areaListId}>
            {areasForGrade(plan.grade_level).map((a) => (
              <option key={a.name} value={a.name} />
            ))}
          </datalist>
          <Field label="Section(s)">
            <Input
              placeholder="e.g. Rizal, Mabini"
              value={plan.sections}
              onChange={(e) => edit({ sections: e.target.value })}
            />
          </Field>
          <Field label="Term">
            <SimpleSelect
              value={String(plan.term)}
              onValueChange={(v) => edit({ term: Number(v) })}
              options={[1, 2, 3].map((t) => ({ value: String(t), label: `Term ${t}` }))}
            />
          </Field>
          <Field label="Week">
            <Input
              type="number"
              min={1}
              max={20}
              value={plan.week}
              onChange={(e) => edit({ week: whole(e.target.value, 1, 20) })}
            />
          </Field>
          <Field label="No. of sessions">
            <Input
              type="number"
              min={1}
              max={10}
              value={plan.sessions}
              onChange={(e) => edit({ sessions: whole(e.target.value, 1, 10) })}
            />
          </Field>
          <Field label="Minutes per session">
            <Input
              type="number"
              min={10}
              max={240}
              step={5}
              value={plan.minutes}
              onChange={(e) => edit({ minutes: whole(e.target.value, 10, 240) })}
            />
          </Field>
          <Field label="Checked by">
            <Input
              placeholder="Master Teacher / Head Teacher"
              value={plan.content.checked_by ?? ""}
              onChange={(e) => editContent({ checked_by: e.target.value })}
            />
          </Field>
        </CardContent>
      </Card>

      <AiDraftPanel plan={plan} onApply={applyAi} onUndo={beforeFill ? undoFill : undefined} />

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
            {SECTIONS.filter((s) => s.part === part.id).map((s) => (
              <Field key={s.key} label={s.label} hint={s.hint}>
                <Textarea
                  className="min-h-20"
                  value={plan.content[s.key] ?? ""}
                  onChange={(e) => editContent({ [s.key]: e.target.value })}
                />
              </Field>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>References and AI use</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="References" hint="Books, curriculum guides, websites and toolkits, one per line">
            <Textarea
              value={plan.content.references ?? ""}
              onChange={(e) => editContent({ references: e.target.value })}
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-declaration">Declaration of AI use</Label>
            <Textarea
              id="ai-declaration"
              placeholder="No AI tool was used."
              value={plan.content.ai_declaration ?? ""}
              onChange={(e) => editContent({ ai_declaration: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Filled in for you when ChatGPT drafts this plan. Say which tool helped and how you checked its work.
            </p>
          </div>
        </CardContent>
      </Card>

      {printing &&
        createPortal(
          <div id="print-root">
            <style>{`@media print {
              @page { size: A4 portrait; margin: 12mm; }
              body > *:not(#print-root) { display: none !important; }
            }`}</style>
            <LessonPlanDocument plan={plan} profile={profile} />
          </div>,
          document.body,
        )}
    </div>
  );
}
