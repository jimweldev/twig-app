import { useCallback, useEffect, useState } from "react";
import {
  listAttendanceMarks,
  listNoClassDays,
  setAttendanceMark,
  setNoClassDay,
  type AttendanceStatus,
} from "@/lib/db";

export const markKey = (learnerId: number, date: string) => `${learnerId}:${date}`;

/** A section's daily attendance: no-class days and absent/late marks. */
export function useAttendance(sectionId: number, onError: (e: unknown) => void) {
  const [noClass, setNoClass] = useState<Set<string>>(new Set());
  const [marks, setMarks] = useState<Map<string, AttendanceStatus>>(new Map());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const [days, m] = await Promise.all([listNoClassDays(sectionId), listAttendanceMarks(sectionId)]);
      setNoClass(new Set(days));
      setMarks(new Map(m.map((x) => [markKey(x.learner_id, x.date), x.status])));
    } catch (e) {
      onError(e);
    } finally {
      setLoading(false);
    }
  }, [sectionId, onError]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Edits update local state first so clicking through the grid stays instant.
  const setMark = (learnerId: number, date: string, status: AttendanceStatus | null) => {
    setMarks((prev) => {
      const next = new Map(prev);
      if (status) next.set(markKey(learnerId, date), status);
      else next.delete(markKey(learnerId, date));
      return next;
    });
    setAttendanceMark(learnerId, date, status).catch((e) => {
      onError(e);
      reload();
    });
  };

  const toggleNoClass = (date: string) => {
    const on = !noClass.has(date);
    setNoClass((prev) => {
      const next = new Set(prev);
      if (on) next.add(date);
      else next.delete(date);
      return next;
    });
    setNoClassDay(sectionId, date, on).catch((e) => {
      onError(e);
      reload();
    });
  };

  const statusOf = (learnerId: number, date: string) => marks.get(markKey(learnerId, date));

  return { noClass, marks, loading, statusOf, setMark, toggleNoClass };
}
