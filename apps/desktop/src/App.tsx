import { useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { AppHeader, type Crumb } from "@/app/AppHeader";
import { AppSidebar, useSidebarCollapsed } from "@/app/AppSidebar";
import { RouterProvider, useRouter, type Route } from "@/app/router";
import { SchoolProvider, useSchool } from "@/app/school";
import { EmptyState, PageSkeleton } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClassView } from "@/ecr/ClassView";
import { AttendancePage } from "@/pages/AttendancePage";
import { ClassRecordsPage } from "@/pages/ClassRecordsPage";
import { ClassSectionPage } from "@/pages/ClassSectionPage";
import { CertificateEditorPage } from "@/pages/CertificateEditorPage";
import { CertificatesPage } from "@/pages/CertificatesPage";
import { GAMES, GamePage, GamesPage } from "@/pages/GamesPage";
import { LessonPlanEditorPage } from "@/pages/LessonPlanEditorPage";
import { LessonPlansPage } from "@/pages/LessonPlansPage";
import { QuizEditorPage } from "@/pages/QuizEditorPage";
import { QuizzesPage } from "@/pages/QuizzesPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ReportCardsPage } from "@/pages/ReportCardsPage";
import { SchoolYearsPage } from "@/pages/SchoolYearsPage";
import { SectionPage } from "@/pages/SectionPage";
import { SectionsPage } from "@/pages/SectionsPage";
import { gradeLabel } from "@/ecr/levels";
import { useAutoBackup } from "@/lib/backup";

const inTauri = "__TAURI_INTERNALS__" in window;

// Keep the splash up long enough to read, so it doesn't just flicker.
const MIN_SPLASH_MS = 900;

function useCrumbs(): Crumb[] {
  const { route } = useRouter();
  const { sections, classes } = useSchool();
  const sectionLabel = (id: number) => {
    const s = sections.find((x) => x.id === id);
    return s ? `${gradeLabel(s.grade_level)} – ${s.name}` : "Section";
  };
  switch (route.page) {
    case "dashboard":
      return [{ label: "Dashboard" }];
    case "schoolYears":
      return [{ label: "School years" }];
    case "sections":
      return [{ label: "Sections" }];
    case "section":
      return [{ label: "Sections", route: { page: "sections" } }, { label: sectionLabel(route.id) }];
    case "classRecords":
      return [{ label: "Class records" }];
    case "classSection":
      return [{ label: "Class records", route: { page: "classRecords" } }, { label: sectionLabel(route.sectionId) }];
    case "class": {
      const c = classes.find((x) => x.id === route.id);
      return [
        { label: "Class records", route: { page: "classRecords" } },
        ...(c
          ? [
              { label: sectionLabel(c.section_id), route: { page: "classSection", sectionId: c.section_id } as Route },
              { label: c.learning_area },
            ]
          : []),
      ];
    }
    case "attendance":
      return [{ label: "Attendance" }];
    case "reportCards":
      return [{ label: "Report cards" }];
    case "lessonPlans":
      return [{ label: "Lesson plans" }];
    case "lessonPlan":
      return [{ label: "Lesson plans", route: { page: "lessonPlans" } }, { label: "Edit lesson plan" }];
    case "quizzes":
      return [{ label: "Quizzes" }];
    case "quiz":
      return [{ label: "Quizzes", route: { page: "quizzes" } }, { label: "Edit quiz" }];
    case "certificates":
      return [{ label: "Certificates" }];
    case "certificate":
      return [{ label: "Certificates", route: { page: "certificates" } }, { label: "Edit template" }];
    case "games":
      return [{ label: "Games" }];
    case "game": {
      // Opened from a class record: keep the trail back to it.
      const c = route.classId !== undefined ? classes.find((x) => x.id === route.classId) : undefined;
      return c
        ? [
            { label: "Class records", route: { page: "classRecords" } },
            { label: sectionLabel(c.section_id), route: { page: "classSection", sectionId: c.section_id } },
            { label: c.learning_area, route: { page: "class", id: c.id } },
            { label: GAMES[route.game].title },
          ]
        : [{ label: "Games", route: { page: "games" } }, { label: GAMES[route.game].title }];
    }
    case "settings":
      return [{ label: "Settings" }];
  }
}

/** Pages that work inside the active school year show this when there is none. */
function RequireActiveYear({ children }: { children: ReactNode }) {
  const { activeYear } = useSchool();
  const { navigate } = useRouter();
  if (activeYear) return children;
  return (
    <div className="page-narrow">
      <EmptyState title="No active school year">
        <p>Sections and class records belong to the active school year.</p>
        <Button className="mt-4" onClick={() => navigate({ page: "schoolYears" })}>
          Set up a school year
        </Button>
      </EmptyState>
    </div>
  );
}

function NotFound() {
  const { navigate } = useRouter();
  return (
    <div className="page-narrow">
      <EmptyState title="This page is no longer available">
        <p>It may have been deleted, or it belongs to a school year that is not active.</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate({ page: "dashboard" })}>
          Go to dashboard
        </Button>
      </EmptyState>
    </div>
  );
}

function Page() {
  const { route, navigate } = useRouter();
  const { activeYear, schoolYears, sections, classes, refresh, onError } = useSchool();

  switch (route.page) {
    case "dashboard":
      return <DashboardPage />;
    case "schoolYears":
      return <SchoolYearsPage schoolYears={schoolYears} onChanged={refresh} onError={onError} />;
    case "sections":
      return (
        <RequireActiveYear>
          <SectionsPage
            schoolYear={activeYear!}
            sections={sections}
            onOpen={(id) => navigate({ page: "section", id })}
            onChanged={refresh}
            onError={onError}
          />
        </RequireActiveYear>
      );
    case "section": {
      const section = sections.find((s) => s.id === route.id);
      if (!activeYear || !section) return <NotFound />;
      return (
        <SectionPage
          key={section.id}
          schoolYear={activeYear}
          section={section}
          localClasses={classes.filter((c) => c.section_id === section.id)}
          onChanged={refresh}
          onError={onError}
        />
      );
    }
    case "classRecords":
      return (
        <RequireActiveYear>
          <ClassRecordsPage />
        </RequireActiveYear>
      );
    case "classSection": {
      const section = sections.find((s) => s.id === route.sectionId);
      return section ? <ClassSectionPage key={section.id} section={section} /> : <NotFound />;
    }
    case "class": {
      const c = classes.find((x) => x.id === route.id);
      return c ? (
        <ClassView key={`${c.id}:${route.term ?? ""}`} classRecord={c} initialTerm={route.term} />
      ) : (
        <NotFound />
      );
    }
    case "attendance":
      return (
        <RequireActiveYear>
          <AttendancePage />
        </RequireActiveYear>
      );
    case "reportCards":
      return (
        <RequireActiveYear>
          <ReportCardsPage />
        </RequireActiveYear>
      );
    case "lessonPlans":
      return <LessonPlansPage />;
    case "lessonPlan":
      return <LessonPlanEditorPage key={route.id} id={route.id} />;
    case "quizzes":
      return <QuizzesPage />;
    case "quiz":
      return <QuizEditorPage key={route.id} id={route.id} />;
    case "certificates":
      return <CertificatesPage />;
    case "certificate":
      return <CertificateEditorPage key={route.id} id={route.id} />;
    case "games":
      return (
        <RequireActiveYear>
          <GamesPage />
        </RequireActiveYear>
      );
    case "game": {
      const section = sections.find((s) => s.id === route.sectionId);
      return section ? (
        <GamePage
          key={`${section.id}:${route.groupsId ?? ""}`}
          game={route.game}
          section={section}
          groupsId={route.groupsId}
        />
      ) : (
        <NotFound />
      );
    }
    case "settings":
      return <SettingsPage tab={route.tab} onSaved={refresh} onError={onError} />;
  }
}

function Shell() {
  const { loaded } = useSchool();
  const crumbs = useCrumbs();
  const [sidebarCollapsed, toggleSidebar] = useSidebarCollapsed();
  const { navigate } = useRouter();
  useAutoBackup(loaded, () => navigate({ page: "settings", tab: "backup" }));

  // Swap the splash window for this one once the first data has loaded.
  useEffect(() => {
    if (!loaded) return;
    const wait = Math.max(0, MIN_SPLASH_MS - performance.now());
    const t = setTimeout(() => invoke("app_ready").catch(console.error), wait);
    return () => clearTimeout(t);
  }, [loaded]);

  return (
    <div className="flex h-screen">
      <AppSidebar collapsed={sidebarCollapsed} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader crumbs={crumbs} sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} />
        <div className="min-h-0 flex-1 overflow-auto bg-muted/30">{loaded ? <Page /> : <PageSkeleton />}</div>
      </main>
    </div>
  );
}

function App() {
  if (!inTauri) {
    return (
      <div className="grid h-screen place-items-center p-8 text-center text-muted-foreground">
        <div>
          <h1 className="text-xl font-semibold text-foreground">TWIG needs the desktop app</h1>
          <p className="mt-2 text-sm">
            Your data saves to a local database. Run <code>npm run dev:desktop</code> from the project root.
          </p>
        </div>
      </div>
    );
  }
  return (
    <TooltipProvider>
      <SchoolProvider>
        <RouterProvider>
          <Shell />
        </RouterProvider>
      </SchoolProvider>
      <Toaster position="bottom-right" closeButton />
    </TooltipProvider>
  );
}

export default App;
