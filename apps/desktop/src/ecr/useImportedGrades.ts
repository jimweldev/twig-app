import { useCallback, useEffect, useState } from "react";
import { listReceived, type ReceivedGrade } from "@/lib/db";
import { receivedFor, type LearnerGrades, type PartImports } from "./classGrades";
import { partArea, partsOf, type AreaPart } from "./levels";

export interface PartImport {
  part: AreaPart;
  info: ReceivedGrade;
  grades: Map<number, LearnerGrades>;
}

/** Grades imported from another teacher for one learning area of a section, and for each of its parts (MAPEH). */
export function useImportedGrades(sectionId: number, learningArea: string, onError: (e: unknown) => void) {
  const [received, setReceived] = useState<ReceivedGrade[]>([]);
  const [info, setInfo] = useState<ReceivedGrade | null>(null);
  const [grades, setGrades] = useState<Map<number, LearnerGrades>>(new Map());
  const [parts, setParts] = useState<PartImport[]>([]);

  const reload = useCallback(async () => {
    try {
      const r = await listReceived(sectionId);
      const whole = receivedFor(r, learningArea);
      setReceived(r.grades);
      setInfo(whole.info);
      setGrades(whole.grades);
      setParts(
        partsOf(learningArea).flatMap((part) => {
          const { info, grades } = receivedFor(r, partArea(learningArea, part.id));
          return info ? [{ part, info, grades }] : [];
        }),
      );
    } catch (e) {
      onError(e);
    }
  }, [sectionId, learningArea, onError]);

  useEffect(() => {
    reload();
  }, [reload]);

  const partGrades: PartImports = new Map(parts.map((p) => [p.part.id, p.grades]));
  return { received, info, grades, parts, partGrades, reload };
}
