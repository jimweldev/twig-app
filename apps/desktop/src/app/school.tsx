import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getProfile,
  listClasses,
  listSchoolYears,
  listSections,
  type ClassRecord,
  type SchoolProfile,
  type SchoolYear,
  type Section,
} from "@/lib/db";

interface SchoolValue {
  loaded: boolean;
  profile: SchoolProfile | null;
  schoolYears: SchoolYear[];
  /** Every page works on the active school year. */
  activeYear: SchoolYear | null;
  sections: Section[];
  classes: ClassRecord[];
  refresh: () => Promise<void>;
  error: string | null;
  onError: (e: unknown) => void;
  clearError: () => void;
}

const SchoolContext = createContext<SchoolValue | null>(null);

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onError = useCallback((e: unknown) => {
    console.error(e);
    setError(e instanceof Error ? e.message : String(e));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [p, years] = await Promise.all([getProfile(), listSchoolYears()]);
      const active = years.find((y) => y.is_active);
      const [s, c] = active
        ? await Promise.all([listSections(active.id), listClasses(active.id)])
        : [[], []];
      setProfile(p);
      setSchoolYears(years);
      setSections(s);
      setClasses(c);
    } catch (e) {
      onError(e);
    } finally {
      setLoaded(true);
    }
  }, [onError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SchoolContext.Provider
      value={{
        loaded,
        profile,
        schoolYears,
        activeYear: schoolYears.find((y) => y.is_active) ?? null,
        sections,
        classes,
        refresh,
        error,
        onError,
        clearError: () => setError(null),
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  const ctx = useContext(SchoolContext);
  if (!ctx) throw new Error("useSchool must be used inside SchoolProvider");
  return ctx;
}
