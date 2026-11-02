import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { cn } from "cn";
import { useRouter } from "@/app/router";
import { useSchool } from "@/app/school";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createLessonPlan } from "@/lib/db";
import { AiDraftPanel } from "./AiDraftPanel";
import { LessonDetailsFields, type LessonDetails } from "./LessonDetailsFields";
import { withAiValues, type AiValues, type LessonPlan } from "./plan";

const STEPS = ["Lesson details", "Draft with ChatGPT"];

/**
 * A new lesson plan in two steps: the lesson's details, then a ChatGPT draft. The plan
 * is saved once the draft is filled in, then opens for editing.
 */
export function NewLessonPlanDialog({
  plans,
  onOpenChange,
}: {
  /** The teacher's plans, newest first; the details start from the latest one. */
  plans: LessonPlan[];
  onOpenChange: (open: boolean) => void;
}) {
  const { navigate } = useRouter();
  const { sections, classes, profile, onError } = useSchool();
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  // Start from the most recent plan, else the first class, so the details are usually right already.
  const [details, setDetails] = useState<LessonDetails>(() => {
    const last = plans[0];
    const firstClass = classes[0];
    const section = firstClass ? sections.find((s) => s.id === firstClass.section_id) : sections[0];
    return {
      title: "",
      grade_level: last?.grade_level ?? section?.grade_level ?? 7,
      learning_area: last?.learning_area ?? firstClass?.learning_area ?? "",
      sections: last?.sections ?? section?.name ?? "",
      term: last?.term ?? 1,
      week: last ? last.week + 1 : 1,
      sessions: last?.sessions ?? 1,
      minutes: last?.minutes ?? 60,
      // Signatories come from the school profile, else the last plan.
      content: {
        prepared_by: profile?.teacher_name ?? "",
        noted_by: profile?.school_head ?? "",
        checked_by: profile?.checker_name || last?.content.checked_by || "",
        prepared_position: profile?.teacher_position || last?.content.prepared_position || "",
        checked_position: profile?.checker_position || last?.content.checked_position || "",
        noted_position: profile?.school_head_position || last?.content.noted_position || "",
      },
    };
  });
  const ready = !!details.title.trim() && !!details.learning_area.trim();

  const fill = async (values: AiValues) => {
    try {
      const id = await createLessonPlan({
        ...details,
        title: details.title.trim(),
        content: withAiValues(details.content, values, details.content.prepared_by || profile?.teacher_name),
      });
      onOpenChange(false);
      navigate({ page: "lessonPlan", id });
    } catch (e) {
      onError(e);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New lesson plan</DialogTitle>
          <DialogDescription>
            Saved after ChatGPT&rsquo;s draft is filled in. You can change everything after.
          </DialogDescription>
        </DialogHeader>

        <ol className="flex items-center gap-3 text-sm">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-3">
              {i > 0 && <span className="h-px w-10 bg-border" />}
              <span className={cn("flex items-center gap-2", i === step ? "font-semibold" : "text-muted-foreground")}>
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                    i < step
                      ? "bg-primary text-primary-foreground"
                      : i === step
                        ? "bg-primary/15 text-primary ring-2 ring-primary"
                        : "bg-muted",
                  )}
                >
                  {i < step ? <Check className="size-3.5" /> : i + 1}
                </span>
                {label}
              </span>
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <>
            <LessonDetailsFields
              value={details}
              onChange={(patch) => setDetails({ ...details, ...patch })}
              titleError={tried && !details.title.trim()}
            />
            {tried && !details.learning_area.trim() && (
              <p className="text-sm text-destructive">Add the learning area too.</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setTried(true);
                  if (ready) setStep(1);
                }}
              >
                Next: draft with ChatGPT <ArrowRight />
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <AiDraftPanel plan={{ ...details, id: 0, updated_at: "" }} onApply={fill} />
            <DialogFooter className="sm:justify-start">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft /> Back to lesson details
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
