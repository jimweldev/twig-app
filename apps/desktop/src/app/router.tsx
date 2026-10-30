import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type Route =
  | { page: "dashboard" }
  | { page: "schoolYears" }
  | { page: "sections" }
  | { page: "section"; id: number }
  | { page: "classRecords" }
  | { page: "classSection"; sectionId: number }
  | { page: "class"; id: number }
  | { page: "attendance" }
  | { page: "reportCards" }
  | { page: "lessonPlans" }
  | { page: "lessonPlan"; id: number }
  | { page: "certificates" }
  /** The designer for one certificate template. */
  | { page: "certificate"; id: number }
  | { page: "games" }
  /** A game played with a section's learners; classId when opened from a class record. */
  | { page: "game"; game: "round-em-up" | "squad-up"; sectionId: number; classId?: number }
  | { page: "profile" };

/** Something on the page that must be settled before leaving it, e.g. an import not yet kept. */
export interface LeaveGuard {
  title: string;
  description: string;
  keepLabel: string;
  discardLabel: string;
  onKeep: () => void | Promise<void>;
  onDiscard: () => void | Promise<void>;
}

interface RouterValue {
  route: Route;
  navigate: (route: Route) => void;
  /** Runs `action` (e.g. switching a tab), asking first while a leave guard is up. */
  guarded: (action: () => void) => void;
  setLeaveGuard: (guard: LeaveGuard | null) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

/** In-memory navigation; a desktop app has no URL bar to sync with. */
export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>({ page: "dashboard" });
  const guard = useRef<LeaveGuard | null>(null);
  // What the teacher tried to do while a guard was up.
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);

  const guarded = (action: () => void) => (guard.current ? setPending(() => action) : action());
  const navigate = (next: Route) => guarded(() => setRoute(next));
  const setLeaveGuard = useCallback((g: LeaveGuard | null) => {
    guard.current = g;
  }, []);

  const leave = async (settle: "onKeep" | "onDiscard") => {
    const g = guard.current;
    const next = pending;
    if (!g || !next) return;
    setBusy(true);
    try {
      await g[settle]();
      guard.current = null;
      next();
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const g = guard.current;
  return (
    <RouterContext.Provider value={{ route, navigate, guarded, setLeaveGuard }}>
      {children}
      <AlertDialog open={!!pending && !!g} onOpenChange={(open) => !open && !busy && setPending(null)}>
        <AlertDialogContent className="sm:max-w-md!">
          <AlertDialogHeader>
            <AlertDialogTitle>{g?.title}</AlertDialogTitle>
            <AlertDialogDescription>{g?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Stay here</AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                leave("onDiscard");
              }}
            >
              {g?.discardLabel}
            </AlertDialogAction>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                leave("onKeep");
              }}
            >
              {g?.keepLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used inside RouterProvider");
  return ctx;
}

/** Asks before leaving the page while `guard` is set; cleared when the component unmounts. */
export function useLeaveGuard(guard: LeaveGuard | null) {
  const { setLeaveGuard } = useRouter();
  useEffect(() => {
    setLeaveGuard(guard);
  });
  useEffect(() => () => setLeaveGuard(null), [setLeaveGuard]);
}
