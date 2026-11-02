import { useSchool } from "@/app/school";
import type { ClassRecord, Learner, ReceivedGrade } from "@/lib/db";
import { gradingModeFor, partsOf } from "./levels";
import { ImportGradesDialog } from "./ImportGradesDialog";
import type { ImportResult } from "./ImportReviewBar";

/** Import grades for this class record's learning area, e.g. a term another teacher handled. */
export function ClassImportButton({
  classRecord,
  learners,
  received,
  onImported,
  shownTerm,
  shownPart,
  disabled,
  lockedTerms,
}: {
  classRecord: ClassRecord;
  learners: Learner[];
  received: ReceivedGrade[];
  onImported: (result: ImportResult) => Promise<void>;
  /** The term tab open in the class record; null on the summary. */
  shownTerm?: number | null;
  /** The part sheet open in a MAPEH record. */
  shownPart?: string;
  disabled?: boolean;
  /** Finalized terms, which imports can't write to. */
  lockedTerms?: number[];
}) {
  const { sections, schoolYears, classes, onError } = useSchool();
  const section = sections.find((s) => s.id === classRecord.section_id);
  const schoolYear = schoolYears.find((y) => y.id === section?.school_year_id);
  if (!section || !schoolYear) return null;
  return (
    <ImportGradesDialog
      schoolYear={schoolYear}
      section={section}
      learners={learners}
      received={received}
      localClasses={classes.filter((c) => c.section_id === section.id)}
      learningArea={classRecord.learning_area}
      shownTerm={shownTerm}
      parts={partsOf(classRecord.learning_area)}
      shownPart={shownPart}
      disabled={disabled}
      lockedTerms={lockedTerms}
      classId={
        gradingModeFor(classRecord.grade_level, classRecord.school_year) === "numeric" ? classRecord.id : undefined
      }
      onImported={onImported}
      onError={onError}
    />
  );
}
