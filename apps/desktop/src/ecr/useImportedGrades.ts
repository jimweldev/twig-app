import { useCallback, useEffect, useState } from "react";
import { listReceived, type ReceivedGrade } from "@/lib/db";
import type { LearnerGrades } from "./classGrades";

/** Grades imported from another teacher for one learning area of a section. */
export function useImportedGrades(sectionId: number, learningArea: string, onError: (e: unknown) => void) {
  const [received, setReceived] = useState<ReceivedGrade[]>([]);
  const [info, setInfo] = useState<ReceivedGrade | null>(null);
  const [grades, setGrades] = useState<Map<number, LearnerGrades>>(new Map());

  const reload = useCallback(async () => {
    try {
      const r = await listReceived(sectionId);
      const info = r.grades.find((g) => g.learning_area === learningArea);
      setReceived(r.grades);
      setInfo(info ?? null);
      setGrades(
        new Map(
          r.rows
            .filter((row) => row.received_id === info?.id)
            .map((row) => [row.learner_id, { terms: [row.term1, row.term2, row.term3], final: row.final }]),
        ),
      );
    } catch (e) {
      onError(e);
    }
  }, [sectionId, learningArea, onError]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { received, info, grades, reload };
}
