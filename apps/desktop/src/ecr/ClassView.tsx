import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Download, Lasso, Lock, Pencil, Trash2, Users } from "lucide-react";
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
import { SubjectDialog } from "./SubjectDialog";
import { FinalizeTermControl, useFinalizedTerms } from "./finalize";
import { ImportReviewBar, type ImportResult } from "./ImportReviewBar";
import { classGrades, gradingContext, withImported, type GradingContext, type LearnerGrades } from "./classGrades";
import { DescriptiveSheet } from "./DescriptiveSheet";
import { ExportGradesDialog } from "./ExportGradesDialog";
import type { Term } from "./grading";
import { KinderSheet } from "./KinderSheet";
import { PartsTermGrades } from "./PartsTermGrades";
import { gradeLabel, subjectTypeOf } from "./levels";
import { SummaryTab } from "./SummaryTab";
import { TermSheet } from "./TermSheet";
import { teacherLabel } from "./TeacherPicker";
import { useImportedGrades, type PartImport } from "./useImportedGrades";
import type { PartImports } from "./classGrades";

type Tab = "1" | "2" | "3" | "summary";

/** WW / PT / Exam class record: one sheet per term the subject runs, plus a summary. */
function NumericRecord({
  classRecord,
  ctx,
  learners,
  imported,
  partImports,
  importButton,
  version,
  focusTerm,
  initialTerm,
  finalized,
}: {
  classRecord: ClassRecord;
  ctx: GradingContext;
  /** The term tab to open on. */
  initialTerm?: number;
  /** Which terms are finalized, with finalize and unfinalize. */
  finalized: ReturnType<typeof useFinalizedTerms>;
  /** Bumped after an import so the sheets reload their scores. */
  version: number;
  /** A term to show, e.g. the one an import just wrote to. */
  focusTerm?: number;
  learners: Learner[];
  /** Grades imported for this subject; they fill terms a learner has no scores for. */
  imported: Map<number, LearnerGrades>;
  /** MAPEH: term grades imported for one part, which replace that part's own. */
  partImports: PartImports;
  /** Renders the import button for the term tab (and part sheet) that is open. */
  importButton: (shownTerm: Term | null, shownPart?: string) => ReactNode;
}) {
  const { onError } = useSchool();
  const classId = classRecord.id;
  const { guarded } = useRouter();
  const [tab, setTab] = useState<Tab>(
    String(initialTerm && ctx.terms.includes(initialTerm as Term) ? initialTerm : ctx.terms[0]) as Tab,
  );
  useEffect(() => {
    if (focusTerm) setTab(String(focusTerm) as Tab);
  }, [focusTerm, version]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [scores, setScores] = useState<Map<string, number>>(new Map());
  // MAPEH: the part whose sheet is open, or "all" for the averaged term grades.
  const [part, setPart] = useState(ctx.parts[0]?.id ?? "");

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
  const grades = withImported(classGrades(learners, activities, scores, ctx, partImports), imported, ctx);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b bg-background px-6 py-2">
        <Tabs value={tab} onValueChange={(v) => guarded(() => setTab(v as Tab))}>
          <TabsList>
            {ctx.terms.map((t) => (
              <TabsTrigger key={t} value={String(t)}>
                Term {t}
                {finalized.isLocked(t) && <Lock className="size-3 text-emerald-700" aria-label="Finalized" />}
              </TabsTrigger>
            ))}
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          {importButton(term, term !== null && part !== "all" ? part : undefined)}
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
      {term !== null && ctx.parts.length > 0 && (
        <div className="border-b bg-background px-6 py-2">
          <Tabs value={part} onValueChange={setPart}>
            <TabsList>
              {ctx.parts.map((p) => (
                <TabsTrigger key={p.id} value={p.id}>
                  {p.label}
                </TabsTrigger>
              ))}
              <TabsTrigger value="all">{classRecord.learning_area} grade</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {term !== null && part === "all" && (
          <PartsTermGrades
            term={term}
            learningArea={classRecord.learning_area}
            learners={learners}
            activities={activities}
            scores={scores}
            ctx={ctx}
            imported={imported}
            partImports={partImports}
          />
        )}
        {term !== null && part !== "all" && (
          <TermSheet
            key={`${term}:${part}`}
            term={term}
            learners={learners}
            activities={activities.filter((a) => a.part === part)}
            scores={scores}
            ctx={ctx}
            // A part sheet shows the grades imported for that part, not the whole learning area's.
            imported={ctx.parts.length ? (partImports.get(part) ?? new Map()) : imported}
            onScore={onScore}
            onHps={onHps}
            onAddActivity={(component) =>
              addActivity(classId, term, component, part).then((a) => setActivities((prev) => [...prev, a]), onError)
            }
            onDeleteActivity={(id) => deleteActivity(id).then(reload, onError)}
            locked={finalized.isLocked(term)}
            finalizeControl={
              <FinalizeTermControl
                term={term}
                finalizedAt={finalized.finalized.get(term)}
                onFinalize={() => finalized.finalize(term)}
                onUnfinalize={() => finalized.unfinalize(term)}
              />
            }
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
  partLabel,
  onRemove,
}: {
  info: ReceivedGrade;
  grades: Map<number, LearnerGrades>;
  /** Grades imported for one part (MAPEH), e.g. "Music and Arts". */
  partLabel?: string;
  onRemove: () => void;
}) {
  const terms = [1, 2, 3].filter((t) => [...grades.values()].some((g) => (g.terms[t - 1] ?? null) !== null));
  const which = terms.length ? `Term ${terms.join(", ")}` : "Imported";
  return (
    <div className="flex items-center gap-3 border-b bg-amber-50 px-6 py-2 text-sm text-amber-900">
      <Download className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        {which} {partLabel ? `${partLabel} ` : ""}grades from {info.teacher_name || "another teacher"}, imported{" "}
        {formatDateTime(info.imported_at)}, replace your own for {terms.length === 1 ? "that term" : "those terms"}.
        They show in italics.
      </p>
      <ConfirmDelete
        title={`Remove the imported ${partLabel ? `${partLabel} ` : ""}grades?`}
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

export function ClassView({ classRecord, initialTerm }: { classRecord: ClassRecord; initialTerm?: number }) {
  const { navigate } = useRouter();
  const { sections, refresh, onError } = useSchool();
  const section = sections.find((s) => s.id === classRecord.section_id);
  const [editingSubject, setEditingSubject] = useState(false);
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
  const finalized = useFinalizedTerms(classRecord.id, onError);
  const [version, setVersion] = useState(0);
  // The last import, until the teacher keeps or undoes it.
  const [review, setReview] = useState<ImportResult | null>(null);
  const reloadAfterImport = async () => {
    await Promise.all([loadLearners(), imported.reload()]);
    setVersion((v) => v + 1);
  };
  const importButton = (shownTerm: Term | null, shownPart?: string) =>
    ctx.mode !== "kinder" && (
      <ClassImportButton
        shownTerm={shownTerm}
        shownPart={shownPart}
        lockedTerms={[...finalized.finalized.keys()]}
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
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[subjectType?.label, `Teacher: ${teacherLabel(classRecord.teacher)}`].filter(Boolean).join(" · ")}
            </p>
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
            {section && (
              <Button variant="outline" onClick={() => setEditingSubject(true)}>
                <Pencil /> Edit subject
              </Button>
            )}
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
      {imported.parts.map((x: PartImport) => (
        <ImportedStrip
          key={x.part.id}
          info={x.info}
          grades={x.grades}
          partLabel={x.part.label}
          onRemove={() => deleteReceived(x.info.id).then(imported.reload, onError)}
        />
      ))}
      <div className="min-h-0 flex-1">
        {ctx.mode === "numeric" && (
          <NumericRecord
            finalized={finalized}
            initialTerm={initialTerm}
            focusTerm={review?.focusTerm}
            classRecord={classRecord}
            ctx={ctx}
            learners={learners}
            imported={imported.grades}
            partImports={imported.partGrades}
            importButton={importButton}
            version={version}
          />
        )}
        {ctx.mode === "descriptive" && (
          <DescriptiveSheet
            classRecord={classRecord}
            learners={learners}
            finalized={finalized}
            imported={imported.grades}
            importButton={importButton}
          />
        )}
        {ctx.mode === "kinder" && (
          <KinderSheet classRecord={classRecord} learners={learners} finalized={finalized} initialTerm={initialTerm} />
        )}
      </div>
      {editingSubject && section && (
        <SubjectDialog
          section={section}
          subject={classRecord}
          onOpenChange={setEditingSubject}
          onSaved={() => setEditingSubject(false)}
        />
      )}
    </div>
  );
}
