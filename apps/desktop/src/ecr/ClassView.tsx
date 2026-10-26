import { useCallback, useEffect, useState } from "react";
import { Trash2, Users } from "lucide-react";
import { useRouter } from "@/app/router";
import { useSchool } from "@/app/school";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addActivity,
  deleteActivity,
  deleteClass,
  listActivities,
  listLearners,
  listScores,
  scoreKey,
  setHighestScore,
  setScore,
  type Activity,
  type ClassRecord,
  type Learner,
} from "@/lib/db";
import { classGrades, gradingContext, type GradingContext } from "./classGrades";
import { DescriptiveSheet } from "./DescriptiveSheet";
import { ExportGradesDialog } from "./ExportGradesDialog";
import type { Term } from "./grading";
import { KinderSheet } from "./KinderSheet";
import { gradeLabel, subjectTypeOf } from "./levels";
import { SummaryTab } from "./SummaryTab";
import { TermSheet } from "./TermSheet";

type Tab = "1" | "2" | "3" | "summary";

/** WW / PT / Exam class record: one sheet per term the subject runs, plus a summary. */
function NumericRecord({
  classRecord,
  ctx,
  learners,
}: {
  classRecord: ClassRecord;
  ctx: GradingContext;
  learners: Learner[];
}) {
  const { onError } = useSchool();
  const classId = classRecord.id;
  const [tab, setTab] = useState<Tab>(String(ctx.terms[0]) as Tab);
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
  }, [reload]);

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b bg-background px-6 py-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            {ctx.terms.map((t) => (
              <TabsTrigger key={t} value={String(t)}>
                Term {t}
              </TabsTrigger>
            ))}
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
        </Tabs>
        <ExportGradesDialog
          classRecord={classRecord}
          learners={learners}
          grades={classGrades(learners, activities, scores, ctx)}
          terms={ctx.terms}
          onError={onError}
        />
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
            onScore={onScore}
            onHps={onHps}
            onAddActivity={(component) =>
              addActivity(classId, term, component).then((a) => setActivities((prev) => [...prev, a]), onError)
            }
            onDeleteActivity={(id) => deleteActivity(id).then(reload, onError)}
          />
        )}
        {tab === "summary" && <SummaryTab learners={learners} activities={activities} scores={scores} ctx={ctx} />}
      </div>
    </div>
  );
}

export function ClassView({ classRecord }: { classRecord: ClassRecord }) {
  const { navigate } = useRouter();
  const { refresh, onError } = useSchool();
  const [learners, setLearners] = useState<Learner[]>([]);
  const ctx = gradingContext(classRecord);
  const subjectType = subjectTypeOf(classRecord.subject_type);

  useEffect(() => {
    listLearners(classRecord.section_id).then(setLearners, onError);
  }, [classRecord.section_id, onError]);

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
      <div className="min-h-0 flex-1">
        {ctx.mode === "numeric" && <NumericRecord classRecord={classRecord} ctx={ctx} learners={learners} />}
        {ctx.mode === "descriptive" && <DescriptiveSheet classRecord={classRecord} learners={learners} />}
        {ctx.mode === "kinder" && <KinderSheet classRecord={classRecord} learners={learners} />}
      </div>
    </div>
  );
}
