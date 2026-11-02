import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  CalendarCheck,
  CalendarRange,
  ClipboardList,
  FileText,
  Gamepad2,
  ListChecks,
  LayoutDashboard,
  NotebookPen,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "cn";
import lockup from "@/assets/twig-lockup.svg";
import { useRouter, type Route } from "./router";
import { useSchool } from "./school";

interface NavItem {
  label: string;
  icon: LucideIcon;
  route: Route;
  /** Routes that keep this item highlighted. */
  pages: Route["page"][];
}

/** Links grouped by what the teacher is doing, so each group is a short list to scan. */
const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "",
    items: [{ label: "Dashboard", icon: LayoutDashboard, route: { page: "dashboard" }, pages: ["dashboard"] }],
  },
  {
    label: "My classes",
    items: [
      { label: "Sections", icon: Users, route: { page: "sections" }, pages: ["sections", "section"] },
      {
        label: "Class records",
        icon: ClipboardList,
        route: { page: "classRecords" },
        pages: ["classRecords", "classSection", "class"],
      },
      { label: "Attendance", icon: CalendarCheck, route: { page: "attendance" }, pages: ["attendance"] },
      { label: "Report cards", icon: FileText, route: { page: "reportCards" }, pages: ["reportCards"] },
    ],
  },
  {
    label: "Teaching",
    items: [
      {
        label: "Lesson plans",
        icon: NotebookPen,
        route: { page: "lessonPlans" },
        pages: ["lessonPlans", "lessonPlan"],
      },
      { label: "Quizzes", icon: ListChecks, route: { page: "quizzes" }, pages: ["quizzes", "quiz"] },
      { label: "Certificates", icon: Award, route: { page: "certificates" }, pages: ["certificates", "certificate"] },
      { label: "Games", icon: Gamepad2, route: { page: "games" }, pages: ["games", "game"] },
    ],
  },
  {
    label: "Setup",
    items: [{ label: "School years", icon: CalendarRange, route: { page: "schoolYears" }, pages: ["schoolYears"] }],
  },
];

const COLLAPSED_KEY = "twig.sidebarCollapsed";

function loadCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Whether the sidebar is hidden, remembered between runs, and a toggle for it. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // Not remembered; it still toggles.
    }
  };
  return [collapsed, toggle] as const;
}

/**
 * The app's navigation: the logo on top, grouped links, the profile at the bottom.
 * Collapsed, it slides fully out of view; the header's button toggles it.
 */
export function AppSidebar({ collapsed }: { collapsed: boolean }) {
  const { route, navigate } = useRouter();
  const { profile } = useSchool();

  const link = (item: { label: string; icon: LucideIcon; active: boolean; onClick: () => void; sub?: string }) => (
    <button
      key={item.label}
      type="button"
      aria-current={item.active ? "page" : undefined}
      onClick={item.onClick}
      className={cn(
        "relative flex w-full items-center overflow-hidden gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm whitespace-nowrap transition-colors",
        item.active
          ? "bg-primary/10 font-medium text-primary"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      {/* A pill on the active link's edge, half hidden by it, so only its rounded right side shows. */}
      {item.active && <span className="absolute inset-y-2 left-0 w-1.5 -translate-x-1/2 rounded-full bg-primary" />}
      <item.icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 overflow-hidden">
        <span className="block truncate">{item.label}</span>
        {item.sub && <span className="block truncate text-xs font-normal text-muted-foreground">{item.sub}</span>}
      </span>
    </button>
  );

  return (
    <aside
      aria-hidden={collapsed}
      inert={collapsed}
      className={cn(
        "h-full shrink-0 overflow-hidden bg-sidebar transition-[width] duration-200 ease-out",
        collapsed ? "w-0" : "w-52 border-r",
      )}
    >
      {/* A fixed width inside, so nothing reflows while the sidebar slides. */}
      <div className="flex h-full w-52 flex-col">
        <div data-tauri-drag-region className="flex shrink-0 items-center justify-center px-3 py-3 select-none">
          <button
            type="button"
            title="Dashboard"
            onClick={() => navigate({ page: "dashboard" })}
            className="flex h-8 shrink-0 items-center"
          >
            <img src={lockup} alt="TWIG" className="h-8" />
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto px-2 py-2">
          {GROUPS.map((group) => (
            <div key={group.label || "home"} className="flex flex-col gap-0.5">
              {group.label && (
                <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase">
                  {group.label}
                </p>
              )}
              {group.items.map((item) =>
                link({
                  label: item.label,
                  icon: item.icon,
                  active: item.pages.includes(route.page),
                  onClick: () => navigate(item.route),
                }),
              )}
            </div>
          ))}
        </nav>

        <div className="border-t p-2">
          {link({
            label: profile?.teacher_name || "Set up your profile",
            sub: profile?.school_name || "Settings",
            icon: Settings,
            active: route.page === "settings",
            onClick: () => navigate({ page: "settings" }),
          })}
        </div>
      </div>
    </aside>
  );
}
