import { useCallback, useEffect, useState } from "react";
import { listObservedValues, setObservedValue, type Marking } from "@/lib/db";

/** SF9 "Report on Learner's Observed Values": core values and their behavior statements. */
export const CORE_VALUES: { name: string; behaviors: { key: string; text: string }[] }[] = [
  {
    name: "Maka-Diyos",
    behaviors: [
      {
        key: "maka-diyos-1",
        text: "Expresses one's spiritual beliefs while respecting the spiritual beliefs of others",
      },
      { key: "maka-diyos-2", text: "Shows adherence to ethical principles by upholding truth" },
    ],
  },
  {
    name: "Makatao",
    behaviors: [
      { key: "makatao-1", text: "Is sensitive to individual, social, and cultural differences" },
      { key: "makatao-2", text: "Demonstrates contributions toward solidarity" },
    ],
  },
  {
    name: "Makakalikasan",
    behaviors: [
      {
        key: "makakalikasan-1",
        text: "Cares for the environment and utilizes resources wisely, judiciously, and economically",
      },
    ],
  },
  {
    name: "Makabansa",
    behaviors: [
      {
        key: "makabansa-1",
        text: "Demonstrates pride in being a Filipino; exercises the rights and responsibilities of a Filipino citizen",
      },
      {
        key: "makabansa-2",
        text: "Demonstrates appropriate behavior in carrying out activities in the school, community, and country",
      },
    ],
  },
];

export const BEHAVIORS = CORE_VALUES.flatMap((v) => v.behaviors);

export const MARKINGS: { code: Marking; label: string }[] = [
  { code: "AO", label: "Always Observed" },
  { code: "SO", label: "Sometimes Observed" },
  { code: "RO", label: "Rarely Observed" },
  { code: "NO", label: "Not Observed" },
];

const valueKey = (learnerId: number, term: number, behavior: string) => `${learnerId}:${term}:${behavior}`;

/** A section's observed-values markings. */
export function useObservedValues(sectionId: number, onError: (e: unknown) => void) {
  const [values, setValues] = useState<Map<string, Marking>>(new Map());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const rows = await listObservedValues(sectionId);
      setValues(new Map(rows.map((r) => [valueKey(r.learner_id, r.term, r.behavior), r.marking])));
    } catch (e) {
      onError(e);
    } finally {
      setLoading(false);
    }
  }, [sectionId, onError]);

  useEffect(() => {
    reload();
  }, [reload]);

  const markingOf = (learnerId: number, term: number, behavior: string) =>
    values.get(valueKey(learnerId, term, behavior));

  // Edits update local state first so clicking through the grid stays instant.
  const setMarking = (learnerId: number, term: number, behavior: string, marking: Marking | null) => {
    setValues((prev) => {
      const next = new Map(prev);
      if (marking) next.set(valueKey(learnerId, term, behavior), marking);
      else next.delete(valueKey(learnerId, term, behavior));
      return next;
    });
    return setObservedValue(learnerId, term, behavior, marking).catch((e) => {
      onError(e);
      reload();
    });
  };

  return { loading, markingOf, setMarking };
}
