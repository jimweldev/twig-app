import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Info, Printer } from "lucide-react";
import { useRouter } from "@/app/router";
import { useSchool } from "@/app/school";
import { Field } from "@/components/field";
import { EmptyState, PageHeader } from "@/components/page";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportCard, type LearnerAttendance } from "@/ecr/ReportCard";
import { schoolMonths, todayIso, totalsFor, weekdaysInMonth, type AttendanceTotals } from "@/attendance/calendar";
import { useAttendance } from "@/attendance/useAttendance";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ObservedValuesGrid } from "@/ecr/ObservedValuesGrid";
import { useObservedValues } from "@/ecr/observedValues";
import { SubjectOrderEditor } from "@/ecr/SubjectOrderEditor";
import { generalAverage, useSectionGrades } from "@/ecr/useSectionGrades";
import { gradingModeFor, KINDER_RECORD } from "@/ecr/levels";
import { useDescriptiveRatings } from "@/ecr/useDescriptiveRatings";
import { listLearners, type Learner, type Section } from "@/lib/db";
import { displayName } from "@/lib/names";
import { gradeLabel } from "@/ecr/levels";

const ALL = "all";

function ReportCards({ section }: { section: Section }) {
  const { navigate } = useRouter();
  const { profile, activeYear, classes, onError } = useSchool();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [selected, setSelected] = useState<string>(ALL);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    listLearners(section.id).then(setLearners, onError);
  }, [section.id, onError]);

  const localClasses = classes.filter((c) => c.section_id === section.id);
  const { areas: allAreas, loading, setOrder } = useSectionGrades(section, learners, localClasses, onError);
  // Only subjects the section actually has: its class records, or (advisory) imported grade files.
  const areas = allAreas.filter((a) => a.kind !== "missing");

  const { noClass, statusOf, loading: attendanceLoading } = useAttendance(section.id, onError);
  const values = useObservedValues(section.id, onError);
  const mode = gradingModeFor(section.grade_level, activeYear?.name ?? "");
  // Kindergarten prints its domain ratings from the section's Kindergarten record.
  const kinderClass = localClasses.find((c) => c.learning_area === KINDER_RECORD);
  const kinder = useDescriptiveRatings(kinderClass?.id ?? 0, onError);
  const kinderCodeOf = (l: Learner) => (term: number, domain: string) => kinder.codeOf(l.id, term, domain);
  const { markingOf, loading: valuesLoading } = values;
  const [view, setView] = useState<"print" | "values">("print");

  const toPrint = selected === ALL ? learners : learners.filter((l) => String(l.id) === selected);
  const preview = toPrint[Math.min(previewIndex, toPrint.length - 1)];

  // Render the cards into a print-only root, print, then remove them.
  useEffect(() => {
    if (!printing) return;
    const t = setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 50);
    return () => clearTimeout(t);
  }, [printing]);

  // Only numeric grading has a general average.
  const noGa = mode === "numeric" ? learners.filter((l) => generalAverage(areas, l.id) === null).length : 0;

  if (!profile || !activeYear) return null;

  // Monthly attendance per learner; only the advisory class keeps attendance, others print blank.
  const months = schoolMonths(activeYear);
  const monthDays = months.map((m) => weekdaysInMonth(m, activeYear));
  const today = todayIso();
  const zero: AttendanceTotals = { schoolDays: 0, present: 0, absent: 0, late: 0 };
  const attendanceOf = (l: Learner): LearnerAttendance => {
    const perMonth = section.is_advisory
      ? monthDays.map((days) => totalsFor(days, noClass, (d) => statusOf(l.id, d), today))
      : months.map(() => zero);
    const total = perMonth.reduce(
      (a, t) => ({
        schoolDays: a.schoolDays + t.schoolDays,
        present: a.present + t.present,
        absent: a.absent + t.absent,
        late: a.late + t.late,
      }),
      zero,
    );
    return { months, perMonth, total };
  };

  // Only the advisory class keeps observed values; other sections print them blank.
  const valuesOf = (l: Learner) =>
    section.is_advisory ? (term: number, behavior: string) => markingOf(l.id, term, behavior) : undefined;

  return (
    <>
    {section.is_advisory && (
      <Tabs value={view} onValueChange={(v) => setView(v as "print" | "values")} className="mb-4">
        <TabsList>
          <TabsTrigger value="print">Report cards</TabsTrigger>
          <TabsTrigger value="values">Observed values</TabsTrigger>
        </TabsList>
      </Tabs>
    )}
    {view === "values" && section.is_advisory ? (
      <ObservedValuesGrid learners={learners} values={values} />
    ) : (
    <div className="grid grid-cols-[20rem_1fr] items-start gap-6">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Subject order</CardTitle>
            <CardDescription>Drag or use the arrows. Saved for this section.</CardDescription>
          </CardHeader>
          <CardContent>
            {!loading && mode === "kinder" ? (
              <p className="text-sm text-muted-foreground">
                Kindergarten report cards list the developmental domains in a fixed order.{" "}
                {!kinderClass && (
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => navigate({ page: "classSection", sectionId: section.id })}
                  >
                    Add the Kindergarten record
                  </button>
                )}
              </p>
            ) : (
              !loading &&
              (areas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No subjects yet.{" "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => navigate({ page: "classSection", sectionId: section.id })}
                  >
                    Add subjects
                  </button>
                  {section.is_advisory && " or import subject teachers' grade files."}
                </p>
              ) : (
                <SubjectOrderEditor grade={section.grade_level} areas={areas} onChange={setOrder} />
              ))
            )}
          </CardContent>
        </Card>

        {(noGa > 0 || !profile.school_head.trim()) && (
          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Info className="size-4 text-amber-600" /> Before printing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {noGa > 0 && (
                <p>{noGa} learner(s) have no general average yet — some terms are still incomplete.</p>
              )}
              {!profile.school_head.trim() && (
                <p>
                  The school head's name is blank.{" "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => navigate({ page: "profile" })}
                  >
                    Add it in School profile
                  </button>
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Field label="Learners" className="w-72">
            <SimpleSelect
              value={selected}
              onValueChange={(v) => {
                setSelected(v);
                setPreviewIndex(0);
              }}
              options={[
                { value: ALL, label: `All learners (${learners.length})` },
                ...learners.map((l) => ({ value: String(l.id), label: displayName(l) })),
              ]}
            />
          </Field>
          <Button disabled={toPrint.length === 0 || loading || attendanceLoading || valuesLoading} onClick={() => setPrinting(true)}>
            <Printer /> Print {toPrint.length > 1 ? `${toPrint.length} report cards` : "report card"}
          </Button>
          {toPrint.length > 1 && (
            <div className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">
              <Button
                variant="outline"
                size="icon-sm"
                title="Previous learner"
                disabled={previewIndex === 0}
                onClick={() => setPreviewIndex((i) => i - 1)}
              >
                <ChevronLeft />
              </Button>
              <span className="w-16 text-center tabular-nums">
                {previewIndex + 1} / {toPrint.length}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                title="Next learner"
                disabled={previewIndex >= toPrint.length - 1}
                onClick={() => setPreviewIndex((i) => i + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          )}
        </div>

        {learners.length === 0 ? (
          <EmptyState title="No learners in this section">
            <Button className="mt-2" variant="outline" onClick={() => navigate({ page: "section", id: section.id })}>
              Add learners
            </Button>
          </EmptyState>
        ) : (
          preview && (
            <div className="overflow-auto rounded-lg border bg-muted/50 p-6">
              {/* Scaled preview of the exact page that prints. */}
              <div className="flex w-fit flex-col gap-6 [zoom:0.8]">
                <ReportCard
                  profile={profile}
                  schoolYear={activeYear}
                  section={section}
                  learner={preview}
                  areas={areas}
                  attendance={attendanceOf(preview)}
                  markingOf={valuesOf(preview)}
                  mode={mode}
                  kinderCodeOf={kinderCodeOf(preview)}
                />
              </div>
            </div>
          )
        )}
      </div>

      {printing &&
        createPortal(
          <div id="print-root">
            {toPrint.map((l) => (
              <ReportCard
                key={l.id}
                profile={profile}
                schoolYear={activeYear}
                section={section}
                learner={l}
                areas={areas}
                attendance={attendanceOf(l)}
                markingOf={valuesOf(l)}
                mode={mode}
                kinderCodeOf={kinderCodeOf(l)}
              />
            ))}
          </div>,
          document.body,
        )}
    </div>
    )}
    </>
  );
}

export function ReportCardsPage() {
  const { sections } = useSchool();
  const [sectionId, setSectionId] = useState<number | null>(
    () => (sections.find((s) => s.is_advisory) ?? sections[0])?.id ?? null,
  );
  const { navigate } = useRouter();
  const section = sections.find((s) => s.id === sectionId);

  return (
    <div className="mx-auto max-w-7xl p-8">
      <PageHeader
        title="Report cards"
        description="Learner's progress report cards (SF9) from the section's consolidated grades."
        actions={
          sections.length > 0 && (
            <SimpleSelect
              className="w-64"
              value={sectionId === null ? "" : String(sectionId)}
              onValueChange={(v) => setSectionId(Number(v))}
              options={sections.map((s) => ({
                value: String(s.id),
                label: `${gradeLabel(s.grade_level)} – ${s.name}${s.is_advisory ? " (advisory)" : ""}`,
              }))}
            />
          )
        }
      />
      <div className="mt-6">
        {!section ? (
          <EmptyState title="No sections yet">
            <Button className="mt-2" onClick={() => navigate({ page: "sections" })}>
              Go to sections
            </Button>
          </EmptyState>
        ) : (
          <ReportCards key={section.id} section={section} />
        )}
      </div>
    </div>
  );
}
