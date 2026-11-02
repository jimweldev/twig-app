import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  RouterProvider as DataRouterProvider,
  createMemoryRouter,
  matchPath,
  useBlocker,
  useLocation,
  useNavigate,
} from "react-router";
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

export const SETTINGS_TABS = ["teacher", "school", "signatories", "backup", "updates", "reset"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export type Route =
  | { page: "dashboard" }
  | { page: "schoolYears" }
  | { page: "sections" }
  | { page: "section"; id: number }
  | { page: "classRecords" }
  | { page: "classSection"; sectionId: number }
  /** term: the tab to open on, e.g. from the dashboard. */
  | { page: "class"; id: number; term?: number }
  | { page: "attendance" }
  | { page: "reportCards" }
  | { page: "lessonPlans" }
  | { page: "lessonPlan"; id: number }
  | { page: "quizzes" }
  | { page: "quiz"; id: number }
  | { page: "certificates" }
  /** The designer for one certificate template. */
  | { page: "certificate"; id: number }
  | { page: "games" }
  /** A game played with a section's learners; classId when opened from a class record. */
  | { page: "game"; game: "round-em-up" | "squad-up"; sectionId: number; classId?: number; groupsId?: number }
  /** tab: the tab to open on, e.g. Signatories from report cards. */
  | { page: "settings"; tab?: SettingsTab };

// ---- Routes as paths (react-router keeps the history of these) ----

const query = (params: Record<string, number | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
};

/** The path a route lives at, e.g. { page: "class", id: 5, term: 2 } → "/class-records/5?term=2". */
export function toPath(route: Route): string {
  switch (route.page) {
    case "dashboard":
      return "/";
    case "schoolYears":
      return "/school-years";
    case "sections":
      return "/sections";
    case "section":
      return `/sections/${route.id}`;
    case "classRecords":
      return "/class-records";
    case "classSection":
      return `/class-records/sections/${route.sectionId}`;
    case "class":
      return `/class-records/${route.id}${query({ term: route.term })}`;
    case "attendance":
      return "/attendance";
    case "reportCards":
      return "/report-cards";
    case "lessonPlans":
      return "/lesson-plans";
    case "lessonPlan":
      return `/lesson-plans/${route.id}`;
    case "quizzes":
      return "/quizzes";
    case "quiz":
      return `/quizzes/${route.id}`;
    case "certificates":
      return "/certificates";
    case "certificate":
      return `/certificates/${route.id}`;
    case "games":
      return "/games";
    case "game":
      return `/games/${route.game}/${route.sectionId}${query({ classId: route.classId, groupsId: route.groupsId })}`;
    case "settings":
      return route.tab ? `/settings/${route.tab}` : "/settings";
  }
}

const num = (v: string | null | undefined) => (v == null || v === "" || isNaN(Number(v)) ? undefined : Number(v));

/** The route at a path; anything unknown is the dashboard. */
export function fromPath(pathname: string, search = ""): Route {
  const q = new URLSearchParams(search);
  const m = (pattern: string) => matchPath(pattern, pathname)?.params;
  let p;
  if ((p = m("/school-years"))) return { page: "schoolYears" };
  if ((p = m("/sections/:id")) && num(p.id) !== undefined) return { page: "section", id: num(p.id)! };
  if ((p = m("/sections"))) return { page: "sections" };
  if ((p = m("/class-records/sections/:sectionId")) && num(p.sectionId) !== undefined)
    return { page: "classSection", sectionId: num(p.sectionId)! };
  if ((p = m("/class-records/:id")) && num(p.id) !== undefined)
    return { page: "class", id: num(p.id)!, term: num(q.get("term")) };
  if ((p = m("/class-records"))) return { page: "classRecords" };
  if ((p = m("/attendance"))) return { page: "attendance" };
  if ((p = m("/report-cards"))) return { page: "reportCards" };
  if ((p = m("/lesson-plans/:id")) && num(p.id) !== undefined) return { page: "lessonPlan", id: num(p.id)! };
  if ((p = m("/lesson-plans"))) return { page: "lessonPlans" };
  if ((p = m("/quizzes/:id")) && num(p.id) !== undefined) return { page: "quiz", id: num(p.id)! };
  if ((p = m("/quizzes"))) return { page: "quizzes" };
  if ((p = m("/certificates/:id")) && num(p.id) !== undefined) return { page: "certificate", id: num(p.id)! };
  if ((p = m("/certificates"))) return { page: "certificates" };
  if (
    (p = m("/games/:game/:sectionId")) &&
    (p.game === "round-em-up" || p.game === "squad-up") &&
    num(p.sectionId) !== undefined
  ) {
    return {
      page: "game",
      game: p.game,
      sectionId: num(p.sectionId)!,
      classId: num(q.get("classId")),
      groupsId: num(q.get("groupsId")),
    };
  }
  if ((p = m("/games"))) return { page: "games" };
  if ((p = m("/settings/:tab")) && SETTINGS_TABS.includes(p.tab as SettingsTab))
    return { page: "settings", tab: p.tab as SettingsTab };
  if ((p = m("/settings"))) return { page: "settings" };
  return { page: "dashboard" };
}

// ---- Leaving a page with something unsettled ----

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
  /** One step back or forward in history. */
  goBack: () => void;
  goForward: () => void;
  /** Runs `action` (e.g. switching a tab), asking first while a leave guard is up. */
  guarded: (action: () => void) => void;
  setLeaveGuard: (guard: LeaveGuard | null) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

/** Inside the data router: turns its location into a Route and asks before leaving a guarded page. */
function RouterBridge({ children }: { children: ReactNode }) {
  const location = useLocation();
  const rrNavigate = useNavigate();
  const guard = useRef<LeaveGuard | null>(null);
  // A guarded action that isn't navigation (e.g. switching a tab), waiting on the dialog.
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);
  // Navigation (links, back, forward) while a guard is up waits here until it's settled.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !!guard.current &&
      (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  );

  const route = fromPath(location.pathname, location.search);
  const navigate = useCallback((next: Route) => void rrNavigate(toPath(next)), [rrNavigate]);
  const goBack = useCallback(() => void rrNavigate(-1), [rrNavigate]);
  const goForward = useCallback(() => void rrNavigate(1), [rrNavigate]);
  const guarded = useCallback((action: () => void) => (guard.current ? setPending(() => action) : action()), []);
  const setLeaveGuard = useCallback((g: LeaveGuard | null) => {
    guard.current = g;
  }, []);

  // The mouse's back/forward buttons and Alt+←/→ step through history, like a browser.
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (e.button === 3) (e.preventDefault(), goBack());
      if (e.button === 4) (e.preventDefault(), goForward());
    };
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowLeft") (e.preventDefault(), goBack());
      if (e.key === "ArrowRight") (e.preventDefault(), goForward());
    };
    window.addEventListener("mouseup", onMouse);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mouseup", onMouse);
      window.removeEventListener("keydown", onKey);
    };
  }, [goBack, goForward]);

  const blocked = blocker.state === "blocked";
  const asking = (blocked || !!pending) && !!guard.current;

  const stay = () => {
    if (blocked) blocker.reset();
    setPending(null);
  };

  const leave = async (settle: "onKeep" | "onDiscard") => {
    const g = guard.current;
    if (!g) return;
    setBusy(true);
    try {
      await g[settle]();
      guard.current = null;
      if (blocked) blocker.proceed();
      else pending?.();
      setPending(null);
    } catch {
      // Settling failed (e.g. a save that didn't go through): stay on the page.
      stay();
    } finally {
      setBusy(false);
    }
  };

  const g = guard.current;
  return (
    <RouterContext.Provider value={{ route, navigate, goBack, goForward, guarded, setLeaveGuard }}>
      {children}
      <AlertDialog open={asking} onOpenChange={(open) => !open && !busy && stay()}>
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

/** What the router renders: the app, handed in from outside so the router is made only once. */
const AppSlot = createContext<ReactNode>(null);
const Slot = () => <RouterBridge>{useContext(AppSlot)}</RouterBridge>;

/**
 * Navigation on react-router, kept in memory: a desktop window has no address bar, but
 * history still works (back, forward, and asking before leaving unsaved work).
 */
export function RouterProvider({ children }: { children: ReactNode }) {
  const [router] = useState(() => createMemoryRouter([{ path: "*", element: <Slot /> }]));
  return (
    <AppSlot.Provider value={children}>
      <DataRouterProvider router={router} />
    </AppSlot.Provider>
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
