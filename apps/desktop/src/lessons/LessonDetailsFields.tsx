import { Fragment } from "react";
import { useSchool } from "@/app/school";
import { Field } from "@/components/field";
import { GRADE_OPTIONS, SimpleSelect } from "@/components/simple-select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { LEARNING_AREAS, areasForGrade, gradeLabel } from "@/ecr/levels";
import type { SchoolProfile } from "@/lib/db";
import type { LessonPlan, PlanContent } from "./plan";

/** The fields of a plan the details form edits. */
export type LessonDetails = Omit<LessonPlan, "id" | "updated_at">;

/** A whole number from a number box, kept within range. */
const whole = (text: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(text) || min)));

/** A note when a known learning area isn't taught in the plan's grade. */
function wrongGradeHint(area: string, grade: number) {
  const known = LEARNING_AREAS.find((a) => a.name.toLowerCase() === area.trim().toLowerCase());
  if (!known || known.grades.includes(grade)) return undefined;
  const from = gradeLabel(known.grades[0]);
  const to = gradeLabel(known.grades[known.grades.length - 1]);
  return `${known.name} is for ${from === to ? from : `${from} to ${to}`}, not ${gradeLabel(grade)}.`;
}

/** The three signatures at the foot of a plan; blanks print the profile's name and position. */
const SIGNERS: {
  label: string;
  name: "prepared_by" | "checked_by" | "noted_by";
  position: "prepared_position" | "checked_position" | "noted_position";
  profileName: (p: SchoolProfile) => string;
  profilePosition: (p: SchoolProfile) => string;
  namePlaceholder: string;
  positionPlaceholder: string;
}[] = [
  {
    label: "Prepared by",
    name: "prepared_by",
    position: "prepared_position",
    profileName: (p) => p.teacher_name,
    profilePosition: (p) => p.teacher_position,
    namePlaceholder: "Your name",
    positionPlaceholder: "Teacher I",
  },
  {
    label: "Checked by",
    name: "checked_by",
    position: "checked_position",
    profileName: (p) => p.checker_name,
    profilePosition: (p) => p.checker_position,
    namePlaceholder: "Master Teacher / Head Teacher",
    positionPlaceholder: "Head Teacher III",
  },
  {
    label: "Noted by",
    name: "noted_by",
    position: "noted_position",
    profileName: (p) => p.school_head,
    profilePosition: (p) => p.school_head_position,
    namePlaceholder: "School head",
    positionPlaceholder: "Principal IV",
  },
];

/** Title, grade, learning area, sections, schedule and checker of a lesson plan. */
export function LessonDetailsFields({
  value,
  onChange,
  titleError,
}: {
  value: LessonDetails;
  onChange: (patch: Partial<LessonDetails>) => void;
  /** Shown under the title when it's required but blank. */
  titleError?: boolean;
}) {
  const { profile } = useSchool();
  const content = (patch: PlanContent) => onChange({ content: { ...value.content, ...patch } });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field
        label="Lesson title"
        required
        className="sm:col-span-2 lg:col-span-4"
        hint={titleError ? "Give the lesson a title." : undefined}
      >
        <Input
          autoFocus
          placeholder="e.g. Parts of a plant"
          aria-invalid={titleError}
          value={value.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </Field>
      <Field label="Grade level">
        <SimpleSelect
          value={String(value.grade_level)}
          onValueChange={(v) => {
            const grade_level = Number(v);
            // A known learning area that isn't taught in the new grade is cleared.
            onChange(
              wrongGradeHint(value.learning_area, grade_level) ? { grade_level, learning_area: "" } : { grade_level },
            );
          }}
          options={GRADE_OPTIONS}
        />
      </Field>
      <Field label="Learning area" required hint={wrongGradeHint(value.learning_area, value.grade_level)}>
        <SimpleSelect
          creatable
          placeholder="Choose or type…"
          value={value.learning_area}
          onValueChange={(v) => onChange({ learning_area: v })}
          options={areasForGrade(value.grade_level).map((a) => ({ value: a.name, label: a.name }))}
        />
      </Field>
      <Field label="Term">
        <SimpleSelect
          value={String(value.term)}
          onValueChange={(v) => onChange({ term: Number(v) })}
          options={[1, 2, 3].map((t) => ({ value: String(t), label: `Term ${t}` }))}
        />
      </Field>
      <Field label="Week">
        <Input
          type="number"
          min={1}
          max={20}
          value={value.week}
          onChange={(e) => onChange({ week: whole(e.target.value, 1, 20) })}
        />
      </Field>
      <Field label="Section(s)" className="sm:col-span-2">
        <Input
          placeholder="e.g. Rizal, Mabini"
          value={value.sections}
          onChange={(e) => onChange({ sections: e.target.value })}
        />
      </Field>
      <Field label="No. of sessions">
        <Input
          type="number"
          min={1}
          max={10}
          value={value.sessions}
          onChange={(e) => onChange({ sessions: whole(e.target.value, 1, 10) })}
        />
      </Field>
      <Field label="Minutes per session">
        <Input
          type="number"
          min={10}
          max={240}
          step={5}
          value={value.minutes}
          onChange={(e) => onChange({ minutes: whole(e.target.value, 10, 240) })}
        />
      </Field>
      <div className="mt-2 flex flex-col gap-4 sm:col-span-2 lg:col-span-4">
        <Separator />
        <div>
          <p className="text-sm font-medium">Signatures</p>
          <p className="text-xs text-muted-foreground">
            Filled in from your school profile. Changes here are for this plan only.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row lg:col-span-4">
        {SIGNERS.map((signer, i) => (
          <Fragment key={signer.label}>
            {i > 0 && <Separator orientation="vertical" className="hidden sm:block" />}
            <div className="flex flex-1 flex-col gap-2">
              <Field label={signer.label}>
                <Input
                  placeholder={(profile && signer.profileName(profile)) || signer.namePlaceholder}
                  value={value.content[signer.name] ?? ""}
                  onChange={(e) => content({ [signer.name]: e.target.value })}
                />
              </Field>
              <Field label="Position">
                <Input
                  placeholder={(profile && signer.profilePosition(profile)) || signer.positionPlaceholder}
                  value={value.content[signer.position] ?? ""}
                  onChange={(e) => content({ [signer.position]: e.target.value })}
                />
              </Field>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
