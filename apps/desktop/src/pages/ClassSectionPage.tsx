import { useState } from "react";
import { ChevronRight, Plus, Users } from "lucide-react";
import { useRouter } from "@/app/router";
import { useSchool } from "@/app/school";
import { Field } from "@/components/field";
import { EmptyState, PageHeader } from "@/components/page";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TERMS, type Term } from "@/ecr/grading";
import {
  areasForGrade,
  gradeLabel,
  gradingModeFor,
  isSeniorHigh,
  KINDER_RECORD,
  numericSchemeFor,
  parseTerms,
  SHS_CORE_SUBJECTS,
  subjectTypeOf,
  subjectTypesForGrade,
  type GradingMode,
  type NumericScheme,
} from "@/ecr/levels";
import { createClass, type ClassRecord, type Section } from "@/lib/db";

const schemeText = ({ weights, exam }: NumericScheme) =>
  `WW ${weights.WW * 100}% · PT ${weights.PT * 100}%` +
  (exam === "none" ? " · no exam" : ` · Exam ${weights.EX * 100}%${exam === "te" ? " (term exam only)" : ""}`);

function gradingText(mode: GradingMode, c: Pick<ClassRecord, "grade_level" | "learning_area" | "subject_type" | "terms">) {
  if (mode === "kinder") return "Descriptive: CO / DV / BG per developmental domain";
  if (mode === "descriptive") return "Descriptive: A–E per term";
  const terms = parseTerms(c.terms);
  return schemeText(numericSchemeFor(c)) + (terms.length < 3 ? ` · Term ${terms.join(", ")}` : "");
}

/** A section's subjects (one class record each). */
export function ClassSectionPage({ section }: { section: Section }) {
  const { navigate } = useRouter();
  const { activeYear, classes, refresh, onError } = useSchool();
  const subjects = classes.filter((c) => c.section_id === section.id);
  const mode = gradingModeFor(section.grade_level, activeYear?.name ?? "");
  const shs = isSeniorHigh(section.grade_level);
  const types = subjectTypesForGrade(section.grade_level);
  const available = areasForGrade(section.grade_level).filter((a) => !subjects.some((c) => c.learning_area === a.name));
  const hasKinder = subjects.some((c) => c.learning_area === KINDER_RECORD);

  const [adding, setAdding] = useState(false);
  const [area, setArea] = useState("");
  const [subjectType, setSubjectType] = useState("");
  const [terms, setTerms] = useState<Term[]>([...TERMS]);

  const duplicate = subjects.some((c) => c.learning_area.toLowerCase() === area.trim().toLowerCase());
  const canAdd = mode === "kinder" ? !hasKinder : shs || available.length > 0;

  const create = async (input: Parameters<typeof createClass>[0]) => {
    try {
      const id = await createClass(input);
      await refresh();
      setAdding(false);
      navigate({ page: "class", id });
    } catch (e) {
      onError(e);
    }
  };

  const openAdd = () => {
    if (mode === "kinder") {
      create({ section_id: section.id, learning_area: KINDER_RECORD });
      return;
    }
    setArea(shs ? "" : (available[0]?.name ?? ""));
    setSubjectType(types[0]?.id ?? "");
    setTerms([...TERMS]);
    setAdding(true);
  };

  const preview = { grade_level: section.grade_level, learning_area: area, subject_type: subjectType, terms: terms.join(",") };
  const valid = area.trim() !== "" && !duplicate && (!shs || (subjectType !== "" && terms.length > 0));

  return (
    <div className="mx-auto max-w-6xl p-8">
      <PageHeader
        title={`${gradeLabel(section.grade_level)} – ${section.name}`}
        description={`${section.learner_count} learners${section.adviser ? ` · Adviser: ${section.adviser}` : ""}`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate({ page: "section", id: section.id })}>
              <Users /> Learners
            </Button>
            <Button onClick={openAdd} disabled={!canAdd}>
              <Plus /> {mode === "kinder" ? "Add Kindergarten record" : "Add subject"}
            </Button>
          </>
        }
      />

      <div className="mt-6">
        {subjects.length === 0 ? (
          <EmptyState title={mode === "kinder" ? "No Kindergarten record yet" : "No subjects yet"}>
            <p>
              {mode === "kinder"
                ? "Kindergarten is assessed as one record across developmental domains."
                : "Add the subjects you teach this section. Each one gets its own class record."}
            </p>
            <Button className="mt-4" onClick={openAdd} disabled={!canAdd}>
              <Plus /> {mode === "kinder" ? "Add Kindergarten record" : "Add subject"}
            </Button>
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((c) => (
              <Card
                key={c.id}
                className="cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
                onClick={() => navigate({ page: "class", id: c.id })}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="truncate">{c.learning_area}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </CardTitle>
                  <CardDescription>
                    {subjectTypeOf(c.subject_type) && (
                      <span className="block text-xs">{subjectTypeOf(c.subject_type)!.label}</span>
                    )}
                    {gradingText(mode, c)}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
        {section.learner_count === 0 && subjects.length > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            This section has no learners yet.{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => navigate({ page: "section", id: section.id })}
            >
              Add learners
            </button>
          </p>
        )}
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add subject</DialogTitle>
            <DialogDescription>
              Creates a class record for {gradeLabel(section.grade_level)} – {section.name}.
            </DialogDescription>
          </DialogHeader>
          <form
            id="add-subject"
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid)
                create({
                  section_id: section.id,
                  learning_area: area.trim(),
                  subject_type: shs ? subjectType : "",
                  terms: shs ? terms.join(",") : "1,2,3",
                });
            }}
          >
            {shs ? (
              <>
                <Field label="Subject" hint={duplicate ? "This section already has that subject." : undefined}>
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
                <Field label="Subject type" hint="Sets the weights (DO 015, s. 2026; DO 8, s. 2015 for Grade 12 on the old curriculum).">
                  <SimpleSelect
                    value={subjectType}
                    onValueChange={setSubjectType}
                    options={types.map((t) => ({ value: t.id, label: t.label }))}
                  />
                </Field>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Terms this subject runs</span>
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
              </>
            ) : (
              <Field label="Learning area">
                <SimpleSelect
                  value={area}
                  onValueChange={setArea}
                  options={available.map((a) => ({ value: a.name, label: a.name }))}
                />
              </Field>
            )}
            {area && (subjectType || !shs) && (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{gradingText(mode, preview)}</p>
            )}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" form="add-subject" disabled={!valid}>
              Add subject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
