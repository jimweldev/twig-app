import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Award,
  CalendarRange,
  Check,
  ClipboardList,
  FileInput,
  Gamepad2,
  NotebookPen,
  Users,
} from "lucide-react";
import { useRouter, type Route } from "@/app/router";
import { useSchool } from "@/app/school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { areasForGrade, gradeLabel, KINDER_RECORD } from "@/ecr/levels";
import { listReceivedAreas } from "@/lib/db";

function Stat({ icon: Icon, label, value, onClick }: { icon: LucideIcon; label: string; value: ReactNode; onClick?: () => void }) {
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

  useEffect(() => {
    if (activeYear) listReceivedAreas(activeYear.id).then(setReceived, onError);
  }, [activeYear, onError]);

  const name = profile?.teacher_name.trim();
  const learners = sections.reduce((n, s) => n + s.learner_count, 0);

  // Advisory class: which learning areas have grades, from this computer's class records or imported files.
  const advisory = sections.find((s) => s.is_advisory);
  const advisoryHas = (area: string) =>
    !!advisory &&
    (classes.some((c) => c.section_id === advisory.id && c.learning_area === area) ||
      received.some((r) => r.section_id === advisory.id && r.learning_area === area));
  // Standard learning areas for the grade, plus Senior High subjects the section actually has.
  const standard = !advisory
    ? []
    : advisory.grade_level === 0
      ? [KINDER_RECORD]
      : areasForGrade(advisory.grade_level).map((a) => a.name);
  const extra = advisory
    ? [
        ...classes.filter((c) => c.section_id === advisory.id).map((c) => c.learning_area),
        ...received.filter((r) => r.section_id === advisory.id).map((r) => r.learning_area),
      ].filter((a, i, all) => !standard.includes(a) && all.indexOf(a) === i)
    : [];
  const advisoryAreas = [...standard, ...extra].map((area) => ({ area, ready: advisoryHas(area) }));
  const done = advisoryAreas.filter((a) => a.ready).length;

  const modules: { icon: LucideIcon; title: string; text: string; route: Route }[] = [
    { icon: NotebookPen, title: "Lesson plans", text: "Daily lesson logs and plans", route: { page: "lessonPlans" } },
    { icon: Award, title: "Certificates", text: "Awards and recognition", route: { page: "certificates" } },
    { icon: Gamepad2, title: "Games", text: "Offline classroom games", route: { page: "games" } },
  ];

  return (
    <div className="mx-auto max-w-6xl p-8">
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
            <Stat icon={Users} label="Sections" value={sections.length} onClick={() => navigate({ page: "sections" })} />
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
                <CardDescription>Learning areas you teach this school year</CardDescription>
                <CardAction>
                  <Button variant="ghost" size="sm" onClick={() => navigate({ page: "classRecords" })}>
                    View all <ArrowRight />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {classes.length === 0 ? (
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
                    {classes.slice(0, 6).map((c) => (
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
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>Learning areas with grades</span>
                      <span className="text-muted-foreground tabular-nums">
                        {done} / {advisoryAreas.length}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${advisoryAreas.length ? (done / advisoryAreas.length) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {advisoryAreas.map((a) => (
                        <Badge key={a.area} variant={a.ready ? "default" : "outline"}>
                          {a.ready && <Check />}
                          {a.area}
                        </Badge>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <h2 className="mt-8 text-sm font-semibold text-muted-foreground">Coming soon</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {modules.map((m) => (
          <Card
            key={m.title}
            className="cursor-pointer gap-0 py-4 transition-colors hover:bg-muted/50"
            onClick={() => navigate(m.route)}
          >
            <CardContent className="flex items-center gap-3">
              <m.icon className="size-5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">{m.title}</div>
                <div className="text-xs text-muted-foreground">{m.text}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
