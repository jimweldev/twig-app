import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listLearners,
  listReceived,
  type ClassRecord,
  type Learner,
  type ReceivedGrade,
  type ReceivedRow,
  type SchoolYear,
  type Section,
} from "@/lib/db";
import { ImportGradesDialog } from "@/ecr/ImportGradesDialog";
import { SectionGrades } from "@/ecr/SectionGrades";
import { SectionLearners } from "./SectionLearners";
import { gradeLabel } from "@/ecr/levels";

type Tab = "learners" | "grades";

export function SectionPage({
  schoolYear,
  section,
  localClasses,
  onChanged,
  onError,
}: {
  schoolYear: SchoolYear;
  section: Section;
  /** This computer's class records for the section. */
  localClasses: ClassRecord[];
  onChanged: () => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const [tab, setTab] = useState<Tab>("learners");
  const [learners, setLearners] = useState<Learner[]>([]);
  const [received, setReceived] = useState<{ grades: ReceivedGrade[]; rows: ReceivedRow[] }>({
    grades: [],
    rows: [],
  });

  const reload = useCallback(async () => {
    try {
      const [l, r] = await Promise.all([listLearners(section.id), listReceived(section.id)]);
      setLearners(l);
      setReceived(r);
    } catch (e) {
      onError(e);
    }
  }, [section.id, onError]);

  useEffect(() => {
    reload();
  }, [reload]);

  const reloadAll = async () => {
    await reload();
    await onChanged();
  };

  const males = learners.filter((l) => l.sex === "M").length;

  return (
    <div className="mx-auto max-w-6xl p-8">
      <PageHeader
        title={`${gradeLabel(section.grade_level)} – ${section.name}`}
        description={[
          `SY ${schoolYear.name}`,
          section.is_advisory ? "Your advisory class" : section.adviser && `Adviser: ${section.adviser}`,
          `${learners.length} learners (${males} male, ${learners.length - males} female)`,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          section.is_advisory && (
            <ImportGradesDialog
              schoolYear={schoolYear}
              section={section}
              learners={learners}
              received={received.grades}
              localClasses={localClasses}
              onImported={async () => {
                await reloadAll();
                setTab("grades");
              }}
              onError={onError}
            />
          )
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-6">
        <TabsList>
          <TabsTrigger value="learners">Learners ({learners.length})</TabsTrigger>
          {section.is_advisory && <TabsTrigger value="grades">Grades</TabsTrigger>}
        </TabsList>
      </Tabs>
      <div className="mt-4">
        {tab === "learners" && (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              Learners here appear in every class record of this section.
            </p>
            <SectionLearners sectionId={section.id} learners={learners} reload={reloadAll} onError={onError} />
          </>
        )}
        {tab === "grades" && section.is_advisory && (
          <SectionGrades
            section={section}
            learners={learners}
            localClasses={localClasses}
            reloadKey={received.grades.map((g) => `${g.id}:${g.checksum}`).join(",")}
            onChanged={reload}
            onError={onError}
          />
        )}
      </div>
    </div>
  );
}
