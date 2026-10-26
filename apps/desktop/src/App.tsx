import { Fragment, useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Award, Gamepad2, NotebookPen, X } from "lucide-react";
import "./App.css";
import { AppSidebar } from "@/app/AppSidebar";
import { RouterProvider, useRouter, type Route } from "@/app/router";
import { SchoolProvider, useSchool } from "@/app/school";
import { EmptyState } from "@/components/page";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClassView } from "@/ecr/ClassView";
import { AttendancePage } from "@/pages/AttendancePage";
import { ClassRecordsPage } from "@/pages/ClassRecordsPage";
import { ClassSectionPage } from "@/pages/ClassSectionPage";
import { ComingSoonPage } from "@/pages/ComingSoonPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { ReportCardsPage } from "@/pages/ReportCardsPage";
import { SchoolYearsPage } from "@/pages/SchoolYearsPage";
import { SectionPage } from "@/pages/SectionPage";
import { SectionsPage } from "@/pages/SectionsPage";
import { gradeLabel } from "@/ecr/levels";

const inTauri = "__TAURI_INTERNALS__" in window;

// Keep the splash up long enough to read, so it doesn't just flicker.
const MIN_SPLASH_MS = 900;

type Crumb = { label: string; route?: Route };

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
    case "certificates":
      return [{ label: "Certificates" }];
    case "games":
      return [{ label: "Games" }];
    case "profile":
      return [{ label: "School profile" }];
  }
}

/** Pages that work inside the active school year show this when there is none. */
function RequireActiveYear({ children }: { children: ReactNode }) {
  const { activeYear } = useSchool();
  const { navigate } = useRouter();
  if (activeYear) return children;
  return (
    <div className="mx-auto max-w-xl p-8">
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
    <div className="mx-auto max-w-xl p-8">
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
      return c ? <ClassView key={c.id} classRecord={c} /> : <NotFound />;
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
      return (
        <ComingSoonPage
          icon={NotebookPen}
          title="Lesson plans"
          description="Write and organize daily lesson logs and lesson plans, linked to your sections and learning areas."
        />
      );
    case "certificates":
      return (
        <ComingSoonPage
          icon={Award}
          title="Certificates"
          description="Generate certificates of recognition and awards from your learners' grades."
        />
      );
    case "games":
      return (
        <ComingSoonPage
          icon={Gamepad2}
          title="Games"
          description="Classroom games and quizzes you can run offline with your class."
        />
      );
    case "profile":
      return <ProfilePage onSaved={refresh} onError={onError} />;
  }
}

function Shell() {
  const { navigate } = useRouter();
  const { loaded, error, clearError } = useSchool();
  const crumbs = useCrumbs();

  // Swap the splash window for this one once the first data has loaded.
  useEffect(() => {
    if (!loaded) return;
    const wait = Math.max(0, MIN_SPLASH_MS - performance.now());
    const t = setTimeout(() => invoke("app_ready").catch(console.error), wait);
    return () => clearTimeout(t);
  }, [loaded]);

  return (
    <SidebarProvider className="h-screen">
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              {crumbs.map((c, i) => (
                <Fragment key={i}>
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {c.route ? (
                      <BreadcrumbLink asChild>
                        <button type="button" onClick={() => navigate(c.route!)}>
                          {c.label}
                        </button>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{c.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        {error && (
          <div className="flex items-center justify-between gap-4 border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-sm text-destructive">
            <span>{error}</span>
            <Button variant="ghost" size="icon-xs" title="Dismiss" onClick={clearError}>
              <X />
            </Button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto bg-muted/30">{loaded && <Page />}</div>
      </SidebarInset>
    </SidebarProvider>
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
    </TooltipProvider>
  );
}

export default App;
