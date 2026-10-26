import { ChevronRight, Users } from "lucide-react";
import { useRouter } from "@/app/router";
import { useSchool } from "@/app/school";
import { EmptyState, PageHeader } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { gradeLabel } from "@/ecr/levels";

/** Class records start from a section: pick one, then its subjects. */
export function ClassRecordsPage() {
  const { navigate } = useRouter();
  const { activeYear, sections, classes } = useSchool();
  const grades = [...new Set(sections.map((s) => s.grade_level))];

  return (
    <div className="mx-auto max-w-6xl p-8">
      <PageHeader
        title="Class records"
        description={`Choose a section to open or add its subjects · SY ${activeYear?.name}`}
      />

      {sections.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No sections yet">
            <p>Class records are kept per section. Add your sections and learners first.</p>
            <Button className="mt-4" onClick={() => navigate({ page: "sections" })}>
              Go to sections
            </Button>
          </EmptyState>
        </div>
      ) : (
        grades.map((g) => (
          <section key={g} className="mt-6">
            <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{gradeLabel(g)}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sections
                .filter((s) => s.grade_level === g)
                .map((s) => {
                  const subjects = classes.filter((c) => c.section_id === s.id);
                  return (
                    <Card
                      key={s.id}
                      className="cursor-pointer gap-3 transition-colors hover:border-primary/50 hover:bg-muted/30"
                      onClick={() => navigate({ page: "classSection", sectionId: s.id })}
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            {s.name}
                            {s.is_advisory && <Badge>Advisory</Badge>}
                          </span>
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </CardTitle>
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="size-3.5" /> {s.learner_count} learners
                          {s.adviser && ` · ${s.adviser}`}
                        </p>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-1.5">
                        {subjects.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No subjects yet</span>
                        ) : (
                          subjects.map((c) => (
                            <Badge key={c.id} variant="secondary">
                              {c.learning_area}
                            </Badge>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
