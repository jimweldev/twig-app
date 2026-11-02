import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CalendarRange, Check, ClipboardList, FileInput, Users } from "lucide-react";
import { useRouter } from "@/app/router";
import { useSchool } from "@/app/school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TERMS } from "@/ecr/grading";
import { gradeLabel, isPartArea, parseTerms } from "@/ecr/levels";
import { listGradedTerms, listReceivedAreas, listSectionFinalizedTerms } from "@/lib/db";

function Stat({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`gap-0 py-4 ${onClick ? "cursor-pointer transition-colors hover:bg-muted/50" : ""}`}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function DashboardPage() {
  const { navigate } = useRouter();
  const { profile, activeYear, sections, classes, onError } = useSchool();
  const [received, setReceived] = useState<{ section_id: number; learning_area: string }[]>([]);
  const [graded, setGraded] = useState<Map<string, Set<number>>>(new Map());
  const [finalized, setFinalized] = useState<Map<number, Set<number>>>(new Map());
  const advisory = sections.find((s) => s.is_advisory);

  useEffect(() => {
    if (activeYear) listReceivedAreas(activeYear.id).then(setReceived, onError);
  }, [activeYear, onError]);
  useEffect(() => {
    if (advisory) {
      listGradedTerms(advisory.id).then(setGraded, onError);
      listSectionFinalizedTerms(advisory.id).then(setFinalized, onError);
    }
  }, [advisory, onError]);

  const name = profile?.teacher_name.trim();
  const learners = sections.reduce((n, s) => n + s.learner_count, 0);
  // Subjects you teach: no other teacher named, or your own name typed in.
  const mine = classes.filter((c) => {
    const t = c.teacher.trim().toLowerCase();
    return !t || t === name?.toLowerCase();
  });

  // Advisory class: the subjects the section has (its class records and imported grades),
  // and which of their terms are finalized. Imported-only subjects can't be finalized,
  // so for those a term counts once it has grades.
  const subjects = advisory
    ? [
        ...classes.filter((c) => c.section_id === advisory.id).map((c) => c.learning_area),
        ...received
          .filter((r) => r.section_id === advisory.id && !isPartArea(r.learning_area))
          .map((r) => r.learning_area),
      ].filter((a, i, all) => all.indexOf(a) === i)
    : [];
  const advisoryAreas = subjects.map((area) => {
    // A class record says which terms the subject runs; imported-only subjects run all three.
    const own = classes.find((c) => c.section_id === advisory?.id && c.learning_area === area);
    const terms = own ? parseTerms(own.terms) : TERMS;
    const ready = (t: number) => (own ? !!finalized.get(own.id)?.has(t) : !!graded.get(area)?.has(t));
    return { area, classId: own?.id, terms: terms.map((t) => ({ term: t, ready: ready(t) })) };
  });
  const allTerms = advisoryAreas.flatMap((a) => a.terms);
  const done = allTerms.filter((t) => t.ready).length;

  return (
    <div className="page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}
          {name ? `, ${name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {[profile?.school_name, activeYear ? `SY ${activeYear.name}` : null].filter(Boolean).join(" · ") ||
            "Welcome to TWIG — Teacher's Work Integration Gateway"}
        </p>
      </div>

      {!activeYear ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Start with a school year</CardTitle>
            <CardDescription>
              Everything in TWIG — sections, learners and class records — belongs to the active school year.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate({ page: "schoolYears" })}>
              <CalendarRange /> Set up school year
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat
              icon={Users}
              label="Sections"
              value={sections.length}
              onClick={() => navigate({ page: "sections" })}
            />
            <Stat icon={Users} label="Learners" value={learners} onClick={() => navigate({ page: "sections" })} />
            <Stat
              icon={ClipboardList}
              label="Class records"
              value={classes.length}
              onClick={() => navigate({ page: "classRecords" })}
            />
            <Stat icon={FileInput} label="Grade files received" value={received.length} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Class records</CardTitle>
                <CardDescription>Subjects you teach this school year</CardDescription>
                <CardAction>
                  <Button variant="ghost" size="sm" onClick={() => navigate({ page: "classRecords" })}>
                    View all <ArrowRight />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {mine.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No class records yet.{" "}
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => navigate({ page: "classRecords" })}
                    >
                      Add one
                    </button>
                  </p>
                ) : (
                  <ul className="divide-y">
                    {mine.slice(0, 6).map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:text-primary"
                          onClick={() => navigate({ page: "class", id: c.id })}
                        >
                          <span className="font-medium">{c.learning_area}</span>
                          <span className="text-muted-foreground">
                            {gradeLabel(c.grade_level)} – {c.section}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Advisory class</CardTitle>
                <CardDescription>
                  {advisory
                    ? `${gradeLabel(advisory.grade_level)} – ${advisory.name} · ${advisory.learner_count} learners`
                    : "Grades collected from subject teachers"}
                </CardDescription>
                {advisory && (
                  <CardAction>
                    <Button variant="ghost" size="sm" onClick={() => navigate({ page: "section", id: advisory.id })}>
                      Open <ArrowRight />
                    </Button>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent>
                {!advisory ? (
                  <p className="text-sm text-muted-foreground">
                    No advisory class set.{" "}
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => navigate({ page: "sections" })}
                    >
                      Mark one in Sections
                    </button>{" "}
                    to import subject teachers' grade files.
                  </p>
                ) : subjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No subjects yet.{" "}
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => navigate({ page: "classSection", sectionId: advisory.id })}
                    >
                      Add subjects
                    </button>{" "}
                    to this section in Class records.
                  </p>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>Terms finalized</span>
                      <span className="text-muted-foreground tabular-nums">
                        {done} / {allTerms.length}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${allTerms.length ? (done / allTerms.length) * 100 : 0}%` }}
                      />
                    </div>
                    <ul className="mt-4 divide-y text-sm">
                      {advisoryAreas.map((a) => (
                        <li key={a.area} className="flex items-center justify-between gap-3 py-1.5">
                          <span className="truncate font-medium">{a.area}</span>
                          <span className="flex shrink-0 gap-1">
                            {a.terms.map((t) => {
                              const title = a.classId
                                ? `Term ${t.term}: ${t.ready ? "finalized" : "not finalized yet"}`
                                : `Term ${t.term}: ${t.ready ? "grades imported" : "no grades yet"}`;
                              const chip = (
                                <>
                                  {t.ready && <Check />}T{t.term}
                                </>
                              );
                              const variant = t.ready ? "default" : "outline";
                              const muted = t.ready ? undefined : "text-muted-foreground";
                              return a.classId ? (
                                <Badge key={t.term} asChild variant={variant} className={muted}>
                                  <button
                                    type="button"
                                    title={`${title} · open the class record`}
                                    className="cursor-pointer hover:opacity-80"
                                    onClick={() => navigate({ page: "class", id: a.classId!, term: t.term })}
                                  >
                                    {chip}
                                  </button>
                                </Badge>
                              ) : (
                                <Badge key={t.term} variant={variant} className={muted} title={title}>
                                  {chip}
                                </Badge>
                              );
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
