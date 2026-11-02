import { useState } from "react";
import { ChevronRight, Pencil, Plus, Users } from "lucide-react";
import { useRouter } from "@/app/router";
import { useSchool } from "@/app/school";
import { EmptyState, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { gradeLabel, gradingModeFor, KINDER_RECORD, subjectTypeOf } from "@/ecr/levels";
import { gradingText, SubjectDialog } from "@/ecr/SubjectDialog";
import { teacherLabel } from "@/ecr/TeacherPicker";
import { createClass, type ClassRecord, type Section } from "@/lib/db";

/** A section's subjects (one class record each). */
export function ClassSectionPage({ section }: { section: Section }) {
  const { navigate } = useRouter();
  const { activeYear, classes, refresh, onError } = useSchool();
  const subjects = classes.filter((c) => c.section_id === section.id);
  const mode = gradingModeFor(section.grade_level, activeYear?.name ?? "");
  const hasKinder = subjects.some((c) => c.learning_area === KINDER_RECORD);
  // Custom subjects can always be added; Kindergarten has just one record.
  const canAdd = mode === "kinder" ? !hasKinder : true;

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ClassRecord | null>(null);

  const openAdd = async () => {
    // Kindergarten has one record and nothing to choose.
    if (mode !== "kinder") {
      setAdding(true);
      return;
    }
    try {
      const id = await createClass({ section_id: section.id, learning_area: KINDER_RECORD });
      await refresh();
      navigate({ page: "class", id });
    } catch (e) {
      onError(e);
    }
  };

  const addLabel = mode === "kinder" ? "Add Kindergarten record" : "Add subject";

  return (
    <div className="page">
      <PageHeader
        title={`${gradeLabel(section.grade_level)} – ${section.name}`}
        description={`${section.learner_count} learners${section.adviser ? ` · Adviser: ${section.adviser}` : ""}`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate({ page: "section", id: section.id })}>
              <Users /> Learners
            </Button>
            <Button onClick={openAdd} disabled={!canAdd}>
              <Plus /> {addLabel}
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
              <Plus /> {addLabel}
            </Button>
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((c) => (
              <Card
                key={c.id}
                className="group cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
                onClick={() => navigate({ page: "class", id: c.id })}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="truncate">{c.learning_area}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Edit subject"
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(c);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </span>
                  </CardTitle>
                  <CardDescription>
                    {subjectTypeOf(c.subject_type) && (
                      <span className="block text-xs">{subjectTypeOf(c.subject_type)!.label}</span>
                    )}
                    {gradingText(mode, c)}
                  </CardDescription>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Teacher: <span className="font-medium text-foreground">{teacherLabel(c.teacher)}</span>
                  </p>
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

      {adding && (
        <SubjectDialog section={section} onOpenChange={setAdding} onSaved={(id) => navigate({ page: "class", id })} />
      )}
      {editing && (
        <SubjectDialog
          section={section}
          subject={editing}
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
    </div>
  );
}
