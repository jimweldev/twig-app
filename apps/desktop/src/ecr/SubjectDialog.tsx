import { useEffect, useState } from "react";
import { cn } from "cn";
import { useSchool } from "@/app/school";
import { Field } from "@/components/field";
import { SimpleSelect } from "@/components/simple-select";
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
import {
  createClass,
  listFinalizedTerms,
  setClassTeacher,
  updateClass,
  type ClassRecord,
  type Section,
} from "@/lib/db";
import { TERMS, type Term } from "./grading";
import {
  areasForGrade,
  defaultSchemeFor,
  EXAM_MODES,
  gradeLabel,
  gradingModeFor,
  isSeniorHigh,
  KINDER_RECORD,
  numericSchemeFor,
  parseCustomScheme,
  parseTerms,
  serializeScheme,
  SHS_CORE_SUBJECTS,
  subjectTypesForGrade,
  type ExamMode,
  type GradingMode,
  type NumericScheme,
} from "./levels";
import { TeacherPicker } from "./TeacherPicker";
import { toast } from "sonner";

const schemeText = ({ weights, exam }: NumericScheme) =>
  `WW ${weights.WW * 100}% · PT ${weights.PT * 100}%` +
  (exam === "none" ? " · no exam" : ` · Exam ${weights.EX * 100}%${exam === "te" ? " (term exam only)" : ""}`);

/** The Learning area menu's "Custom subject…" choice. */
const CUSTOM = "__custom__";

/** How a subject is graded, in one line. */
export function gradingText(
  mode: GradingMode,
  c: Pick<ClassRecord, "grade_level" | "learning_area" | "subject_type" | "terms"> & { weights?: string },
) {
  if (mode === "kinder") return "Descriptive: CO / DV / BG per developmental domain";
  if (mode === "descriptive") return "Descriptive: A–E per term";
  const terms = parseTerms(c.terms);
  return (
    schemeText(numericSchemeFor(c)) +
    (parseCustomScheme(c.weights) ? " · custom weights" : "") +
    (terms.length < 3 ? ` · Term ${terms.join(", ")}` : "")
  );
}

/**
 * Adds a subject to a section, or edits one (`subject`): the learning area (or, in
 * Senior High, the subject, its type and terms) and who teaches it.
 */
export function SubjectDialog({
  section,
  subject,
  onOpenChange,
  onSaved,
}: {
  section: Section;
  /** The subject being edited; absent when adding. */
  subject?: ClassRecord;
  onOpenChange: (open: boolean) => void;
  onSaved: (classId: number) => void;
}) {
  const { activeYear, classes, refresh, onError } = useSchool();
  const others = classes.filter((c) => c.section_id === section.id && c.id !== subject?.id);
  const mode = gradingModeFor(section.grade_level, activeYear?.name ?? "");
  const shs = isSeniorHigh(section.grade_level);
  const kinder = subject?.learning_area === KINDER_RECORD;
  const types = subjectTypesForGrade(section.grade_level);
  const available = areasForGrade(section.grade_level).filter((a) => !others.some((c) => c.learning_area === a.name));
  const standardNames = areasForGrade(section.grade_level).map((a) => a.name);

  const [area, setArea] = useState(subject?.learning_area ?? (shs ? "" : (available[0]?.name ?? "")));
  // A subject outside the standard learning areas, typed in by the teacher.
  // Also the start when every standard learning area is already taken.
  const [custom, setCustom] = useState(
    !shs && !kinder && (subject ? !standardNames.includes(subject.learning_area) : available.length === 0),
  );
  const saved = parseCustomScheme(subject?.weights);
  const [ownWeights, setOwnWeights] = useState(saved !== null);
  const [pct, setPct] = useState(() => {
    const s = saved?.weights ?? { WW: 0.2, PT: 0.5, EX: 0.3 };
    return { WW: Math.round(s.WW * 100), PT: Math.round(s.PT * 100), EX: Math.round(s.EX * 100) };
  });
  const [exam, setExam] = useState<ExamMode>(saved?.exam ?? "split");
  const [subjectType, setSubjectType] = useState(subject?.subject_type || (types[0]?.id ?? ""));
  const [terms, setTerms] = useState<Term[]>(subject ? parseTerms(subject.terms) : [...TERMS]);
  const [teacher, setTeacher] = useState(subject?.teacher ?? "");
  const [busy, setBusy] = useState(false);
  // Finalized terms of the subject being edited: its grading can't change under them.
  const [finalizedTerms, setFinalizedTerms] = useState<number[]>([]);
  useEffect(() => {
    if (subject) listFinalizedTerms(subject.id).then((m) => setFinalizedTerms([...m.keys()].sort()), onError);
  }, [subject, onError]);
  const gradingLocked = finalizedTerms.length > 0;
  const lockNote = gradingLocked && (
    <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
      Term {finalizedTerms.join(", ")} {finalizedTerms.length === 1 ? "is" : "are"} finalized, so the grading
      can&rsquo;t change. Unfinalize {finalizedTerms.length === 1 ? "it" : "them"} in the class record to edit this.
    </p>
  );
  const lockClass = gradingLocked ? "pointer-events-none opacity-60" : undefined;

  const duplicate = others.some((c) => c.learning_area.toLowerCase() === area.trim().toLowerCase());
  const examPct = exam === "none" ? 0 : pct.EX;
  const total = pct.WW + pct.PT + examPct;
  const weights =
    mode === "numeric" && ownWeights
      ? serializeScheme({ weights: { WW: pct.WW / 100, PT: pct.PT / 100, EX: examPct / 100 }, exam })
      : "";
  const weightsOk = !ownWeights || mode !== "numeric" || total === 100;
  const valid =
    kinder || (area.trim() !== "" && !duplicate && weightsOk && (!shs || (subjectType !== "" && terms.length > 0)));
  const preview = {
    grade_level: section.grade_level,
    learning_area: area,
    subject_type: subjectType,
    terms: terms.join(","),
    weights,
  };
  // Custom weights start from the DepEd ones, so the teacher only changes what differs.
  const startOwnWeights = () => {
    const d = defaultSchemeFor(preview);
    setPct({
      WW: Math.round(d.weights.WW * 100),
      PT: Math.round(d.weights.PT * 100),
      EX: Math.round(d.weights.EX * 100),
    });
    setExam(d.exam);
    setOwnWeights(true);
  };

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const input = {
        section_id: section.id,
        learning_area: kinder ? KINDER_RECORD : area.trim(),
        subject_type: shs ? subjectType : "",
        terms: shs ? terms.join(",") : "1,2,3",
        weights,
      };
      let id = subject?.id;
      if (id === undefined) {
        id = await createClass({ ...input, teacher });
      } else {
        await updateClass(id, input);
        await setClassTeacher(id, teacher);
      }
      await refresh();
      onOpenChange(false);
      onSaved(id);
      toast.success(subject ? "Subject updated" : "Subject added");
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{subject ? `Edit ${subject.learning_area}` : "Add subject"}</DialogTitle>
          <DialogDescription>
            {subject
              ? "Scores and grades stay with the subject."
              : `Creates a class record for ${gradeLabel(section.grade_level)} – ${section.name}.`}
          </DialogDescription>
        </DialogHeader>
        <form
          id="subject-form"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {kinder ? null : shs ? (
            <>
              <Field label="Subject" required hint={duplicate ? "This section already has that subject." : undefined}>
                <Input
                  value={area}
                  autoFocus
                  list="shs-subjects"
                  placeholder="e.g. Effective Communication"
                  aria-invalid={duplicate}
                  onChange={(e) => setArea(e.target.value)}
                />
              </Field>
              <datalist id="shs-subjects">
                {SHS_CORE_SUBJECTS.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              {lockNote}
              <fieldset disabled={gradingLocked} className={cn("flex flex-col gap-4", lockClass)}>
                <Field
                  label="Subject type"
                  required
                  hint="Sets the weights (DO 015, s. 2026; DO 8, s. 2015 for Grade 12 on the old curriculum)."
                >
                  <SimpleSelect
                    value={subjectType}
                    onValueChange={setSubjectType}
                    options={types.map((t) => ({ value: t.id, label: t.label }))}
                  />
                </Field>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">
                    Terms this subject runs <span className="text-destructive">*</span>
                  </span>
                  <div className="flex gap-4">
                    {TERMS.map((t) => (
                      <label key={t} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={terms.includes(t)}
                          onChange={(e) =>
                            setTerms((prev) => (e.target.checked ? [...prev, t].sort() : prev.filter((x) => x !== t)))
                          }
                        />
                        Term {t}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">The final grade averages only these terms.</p>
                </div>
              </fieldset>
            </>
          ) : (
            <>
              <Field label="Learning area" required>
                <SimpleSelect
                  value={custom ? CUSTOM : area}
                  onValueChange={(v) => {
                    setCustom(v === CUSTOM);
                    setArea(v === CUSTOM ? "" : v);
                  }}
                  options={[
                    ...available.map((a) => ({ value: a.name, label: a.name })),
                    { value: CUSTOM, label: "Custom subject…" },
                  ]}
                />
              </Field>
              {custom && (
                <Field
                  label="Subject name"
                  required
                  hint={duplicate ? "This section already has that subject." : undefined}
                >
                  <Input
                    autoFocus
                    value={area}
                    placeholder="e.g. Journalism"
                    aria-invalid={duplicate}
                    onChange={(e) => setArea(e.target.value)}
                  />
                </Field>
              )}
            </>
          )}
          {mode === "numeric" && !kinder && !shs && lockNote}
          {mode === "numeric" && !kinder && (
            <fieldset disabled={gradingLocked} className={cn("flex flex-col gap-2", lockClass)}>
              <span className="text-sm font-medium">Grading weights</span>
              <div className="flex gap-2">
                {[
                  { own: false, label: "DepEd weights" },
                  { own: true, label: "Custom weights" },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    aria-pressed={ownWeights === o.own}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-1.5 text-sm",
                      ownWeights === o.own
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "hover:bg-muted/60",
                    )}
                    onClick={() => (o.own ? startOwnWeights() : setOwnWeights(false))}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {ownWeights && (
                <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["WW", "Written Works"],
                        ["PT", "Performance"],
                        ["EX", "Exams"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex min-w-0 flex-col gap-1">
                        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
                        <span className="relative">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            className="bg-background pr-7 tabular-nums"
                            disabled={key === "EX" && exam === "none"}
                            value={key === "EX" ? examPct : pct[key]}
                            onChange={(e) =>
                              setPct({
                                ...pct,
                                [key]: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))),
                              })
                            }
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
                            %
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Exam setup</span>
                    <SimpleSelect value={exam} onValueChange={(v) => setExam(v as ExamMode)} options={EXAM_MODES} />
                  </label>
                  <p className={cn("text-xs font-medium", total === 100 ? "text-primary" : "text-destructive")}>
                    Total {total}%{total === 100 ? " ✓" : " — must add up to 100%"}
                  </p>
                </div>
              )}
            </fieldset>
          )}
          <TeacherPicker value={teacher} onChange={setTeacher} />
          {!kinder && area && (subjectType || !shs) && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{gradingText(mode, preview)}</p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="subject-form" disabled={!valid || busy}>
            {subject ? "Save" : "Add subject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
