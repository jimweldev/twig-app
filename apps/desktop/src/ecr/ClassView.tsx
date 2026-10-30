import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Download, Lasso, Trash2, Users } from "lucide-react";
import { useRouter } from "@/app/router";
import { useSchool } from "@/app/school";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { RoundEmUp, type RoundMemory } from "@/games/RoundEmUp";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addActivity,
  deleteActivity,
  deleteClass,
  deleteReceived,
  listActivities,
  listLearners,
  listScores,
  scoreKey,
  setHighestScore,
  setScore,
  type Activity,
  type ClassRecord,
  type Learner,
  type ReceivedGrade,
} from "@/lib/db";
import { ClassImportButton } from "./ClassImportButton";
import { ImportReviewBar, type ImportResult } from "./ImportReviewBar";
import { classGrades, gradingContext, withImported, type GradingContext, type LearnerGrades } from "./classGrades";
import { DescriptiveSheet } from "./DescriptiveSheet";
import { ExportGradesDialog } from "./ExportGradesDialog";
import type { Term } from "./grading";
import { KinderSheet } from "./KinderSheet";
import { gradeLabel, subjectTypeOf } from "./levels";
import { SummaryTab } from "./SummaryTab";
import { TermSheet } from "./TermSheet";
import { useImportedGrades } from "./useImportedGrades";

type Tab = "1" | "2" | "3" | "summary";

/** WW / PT / Exam class record: one sheet per term the subject runs, plus a summary. */
function NumericRecord({
  classRecord,
  ctx,
  learners,
  imported,
  importButton,
  version,
  focusTerm,
}: {
  classRecord: ClassRecord;
  ctx: GradingContext;
  /** Bumped after an import so the sheets reload their scores. */
  version: number;
  /** A term to show, e.g. the one an import just wrote to. */
  focusTerm?: number;
  learners: Learner[];
  /** Grades imported for this subject; they fill terms a learner has no scores for. */
  imported: Map<number, LearnerGrades>;
  /** Renders the import button for the term tab that is open. */
  importButton: (shownTerm: Term | null) => ReactNode;
}) {
  const { onError } = useSchool();
  const classId = classRecord.id;
  const { guarded } = useRouter();
  const [tab, setTab] = useState<Tab>(String(ctx.terms[0]) as Tab);
  useEffect(() => {
    if (focusTerm) setTab(String(focusTerm) as Tab);
  }, [focusTerm, version]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [scores, setScores] = useState<Map<string, number>>(new Map());

  const reload = useCallback(async () => {
    try {
      const [a, s] = await Promise.all([listActivities(classId), listScores(classId)]);
      setActivities(a);
      setScores(new Map(s.map((x) => [scoreKey(x.activity_id, x.learner_id), x.score])));
    } catch (e) {
      onError(e);
    }
  }, [classId, onError]);

  useEffect(() => {
    reload();
  }, [reload, version]);

  // Score and HPS edits update local state first so the sheet stays responsive.
  const onScore = (activityId: number, learnerId: number, score: number | null) => {
    setScores((prev) => {
      const next = new Map(prev);
      const key = scoreKey(activityId, learnerId);
      if (score === null) next.delete(key);
      else next.set(key, score);
      return next;
    });
    setScore(activityId, learnerId, score).catch((e) => {
      onError(e);
      reload();
    });
  };

  const onHps = (activityId: number, hps: number) => {
    setActivities((prev) => prev.map((a) => (a.id === activityId ? { ...a, highest_score: hps } : a)));
    setHighestScore(activityId, hps).catch((e) => {
      onError(e);
      reload();
    });
  };

  const term = tab === "summary" ? null : (Number(tab) as Term);
  const grades = withImported(classGrades(learners, activities, scores, ctx), imported, ctx);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b bg-background px-6 py-2">
        <Tabs value={tab} onValueChange={(v) => guarded(() => setTab(v as Tab))}>
          <TabsList>
            {ctx.terms.map((t) => (
              <TabsTrigger key={t} value={String(t)}>
                Term {t}
              </TabsTrigger>
            ))}
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          {importButton(term)}
          <ExportGradesDialog
            classRecord={classRecord}
            learners={learners}
            grades={grades}
            terms={ctx.terms}
            raw={{ activities, scores }}
            shownTerm={term}
            onError={onError}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {term !== null && (
          <TermSheet
            key={term}
            term={term}
            learners={learners}
            activities={activities}
            scores={scores}
            ctx={ctx}
            imported={imported}
            onScore={onScore}
            onHps={onHps}
            onAddActivity={(component) =>
              addActivity(classId, term, component).then((a) => setActivities((prev) => [...prev, a]), onError)
            }
            onDeleteActivity={(id) => deleteActivity(id).then(reload, onError)}
          />
        )}
        {tab === "summary" && <SummaryTab learners={learners} grades={grades} ctx={ctx} />}
      </div>
    </div>
  );
}

const formatDateTime = (sqlite: string) =>
  new Date(`${sqlite.replace(" ", "T")}Z`).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });

/** Says which terms come from imported grades, with a way to go back to the teacher's own. */
function ImportedStrip({
  info,
  grades,
  onRemove,
}: {
  info: ReceivedGrade;
  grades: Map<number, LearnerGrades>;
  onRemove: () => void;
}) {
  const terms = [1, 2, 3].filter((t) => [...grades.values()].some((g) => (g.terms[t - 1] ?? null) !== null));
  const which = terms.length ? `Term ${terms.join(", ")}` : "Imported";
  return (
    <div className="flex items-center gap-3 border-b bg-amber-50 px-6 py-2 text-sm text-amber-900">
      <Download className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        {which} grades from {info.teacher_name || "another teacher"}, imported {formatDateTime(info.imported_at)},
        replace your own for {terms.length === 1 ? "that term" : "those terms"}. They show in italics.
      </p>
      <ConfirmDelete
        title="Remove the imported grades?"
        description="Your own scores and ratings show again for every term. You can import the grades again later."
        confirmLabel="Remove"
        onConfirm={onRemove}
        trigger={
          <Button variant="outline" size="sm" className="shrink-0 bg-transparent">
            Remove imported grades
          </Button>
        }
      />
    </div>
  );
}

export function ClassView({ classRecord }: { classRecord: ClassRecord }) {
  const { navigate } = useRouter();
  const { refresh, onError } = useSchool();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [pickOpen, setPickOpen] = useState(false);
  // The picker remembers its herd while this class record is open, so a teacher
  // can pick a learner, close the drawer to enter a score, and come back.
  const [pickMemory, setPickMemory] = useState<RoundMemory | null>(null);
  const ctx = gradingContext(classRecord);
  const subjectType = subjectTypeOf(classRecord.subject_type);

  const loadLearners = useCallback(
    () => listLearners(classRecord.section_id).then(setLearners, onError),
    [classRecord.section_id, onError],
  );
  useEffect(() => {
    loadLearners();
  }, [loadLearners]);
  const imported = useImportedGrades(classRecord.section_id, classRecord.learning_area, onError);
  const [version, setVersion] = useState(0);
  // The last import, until the teacher keeps or undoes it.
  const [review, setReview] = useState<ImportResult | null>(null);
  const reloadAfterImport = async () => {
    await Promise.all([loadLearners(), imported.reload()]);
    setVersion((v) => v + 1);
  };
  const importButton = (shownTerm: Term | null) =>
    ctx.mode !== "kinder" && (
      <ClassImportButton
        shownTerm={shownTerm}
        disabled={!!review}
        classRecord={classRecord}
        learners={learners}
        received={imported.received}
        onImported={async (result) => {
          await reloadAfterImport();
          setReview(result);
        }}
      />
    );

  const modeLabel =
    ctx.mode === "kinder"
      ? "Descriptive: CO / DV / BG"
      : ctx.mode === "descriptive"
        ? "Descriptive: A–E"
        : `WW ${ctx.scheme.weights.WW * 100}% · PT ${ctx.scheme.weights.PT * 100}%${
            ctx.scheme.exam === "none" ? "" : ` · Exam ${ctx.scheme.weights.EX * 100}%`
          }`;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b bg-background px-6 pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-primary uppercase">
              {gradeLabel(classRecord.grade_level)} – {classRecord.section} · SY {classRecord.school_year}
            </p>
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
              {classRecord.learning_area}
              <Badge variant="secondary" className="font-normal">
                {modeLabel}
              </Badge>
            </h1>
            {subjectType && <p className="mt-0.5 text-xs text-muted-foreground">{subjectType.label}</p>}
          </div>
          <div className="flex gap-2">
            <Sheet open={pickOpen} onOpenChange={setPickOpen}>
              <SheetTrigger asChild>
                <Button variant="outline">
                  <Lasso /> Pick a learner
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="gap-3 px-6 pb-6 data-[side=bottom]:h-[88vh]">
                <SheetHeader className="px-0 pb-0">
                  <SheetTitle>Round &rsquo;Em Up</SheetTitle>
                  <SheetDescription>
                    Pick a random learner · {gradeLabel(classRecord.grade_level)} – {classRecord.section}
                  </SheetDescription>
                </SheetHeader>
                {pickOpen && <RoundEmUp learners={learners} memory={pickMemory} onMemoryChange={setPickMemory} />}
              </SheetContent>
            </Sheet>
            <Button variant="outline" onClick={() => navigate({ page: "section", id: classRecord.section_id })}>
              <Users /> Learners ({learners.length})
            </Button>
            <ConfirmDelete
              title={`Remove ${classRecord.learning_area}?`}
              description={`This deletes the ${classRecord.learning_area} class record of ${gradeLabel(classRecord.grade_level)} – ${classRecord.section}, with all its grades. Learners stay in the section. This cannot be undone.`}
              confirmLabel="Remove subject"
              onConfirm={() =>
                deleteClass(classRecord.id).then(async () => {
                  await refresh();
                  navigate({ page: "classSection", sectionId: classRecord.section_id });
                }, onError)
              }
              trigger={
                <Button variant="ghost" size="icon" title="Remove subject">
                  <Trash2 />
                </Button>
              }
            />
          </div>
        </div>
      </header>
      {review && (
        <ImportReviewBar
          result={review}
          onUndone={reloadAfterImport}
          onKeep={() => setReview(null)}
          onError={onError}
        />
      )}
      {imported.info && (
        <ImportedStrip
          info={imported.info}
          grades={imported.grades}
          onRemove={() => deleteReceived(imported.info!.id).then(imported.reload, onError)}
        />
      )}
      <div className="min-h-0 flex-1">
        {ctx.mode === "numeric" && (
          <NumericRecord
            focusTerm={review?.focusTerm}
            classRecord={classRecord}
            ctx={ctx}
            learners={learners}
            imported={imported.grades}
            importButton={importButton}
            version={version}
          />
        )}
        {ctx.mode === "descriptive" && (
          <DescriptiveSheet
            classRecord={classRecord}
            learners={learners}
            imported={imported.grades}
            importButton={importButton}
          />
        )}
        {ctx.mode === "kinder" && <KinderSheet classRecord={classRecord} learners={learners} />}
      </div>
    </div>
  );
}
