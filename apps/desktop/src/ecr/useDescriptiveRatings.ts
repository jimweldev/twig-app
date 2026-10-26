import { useCallback, useEffect, useState } from "react";
import { listDescriptive, setDescriptive } from "@/lib/db";

const key = (learnerId: number, term: number, item: string) => `${learnerId}:${term}:${item}`;

/** A class record's descriptive ratings (Grades 1-3 A-E, Kindergarten CO/DV/BG). */
export function useDescriptiveRatings(classId: number, onError: (e: unknown) => void) {
  const [ratings, setRatings] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const rows = await listDescriptive(classId);
      setRatings(new Map(rows.map((r) => [key(r.learner_id, r.term, r.item), r.code])));
    } catch (e) {
      onError(e);
    } finally {
      setLoading(false);
    }
  }, [classId, onError]);

  useEffect(() => {
    reload();
  }, [reload]);

  const codeOf = (learnerId: number, term: number, item = "") => ratings.get(key(learnerId, term, item)) ?? null;

  // Edits update local state first so the sheet stays responsive.
  const setCode = (learnerId: number, term: number, item: string, code: string | null) => {
    setRatings((prev) => {
      const next = new Map(prev);
      if (code) next.set(key(learnerId, term, item), code);
      else next.delete(key(learnerId, term, item));
      return next;
    });
    setDescriptive(classId, learnerId, term, item, code).catch((e) => {
      onError(e);
      reload();
    });
  };

  return { loading, codeOf, setCode };
}
