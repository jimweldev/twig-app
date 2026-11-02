import { Fragment } from "react";
import { ArrowLeft, CalendarDays, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "cn";
import { useRouter, type Route } from "./router";
import { useSchool } from "./school";
import { WindowControls } from "./WindowControls";

export interface Crumb {
  label: string;
  route?: Route;
}

const today = () =>
  new Date().toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

/**
 * The window's title bar: a Back button on inner pages, where you are, today's date with
 * the active school year, and the window buttons. Empty space drags the window, and
 * double-clicking it maximizes, like a normal title bar.
 */
export function AppHeader({
  crumbs,
  sidebarCollapsed,
  onToggleSidebar,
}: {
  crumbs: Crumb[];
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  const { navigate } = useRouter();
  const { activeYear } = useSchool();
  // Back goes one level up the trail, not through history, so it's always predictable.
  const up = [...crumbs].reverse().find((c, i) => i > 0 && c.route)?.route;

  return (
    <header
      data-tauri-drag-region
      className="flex h-11 shrink-0 items-center gap-3 border-b bg-background pl-5 select-none"
    >
      <button
        type="button"
        title={sidebarCollapsed ? "Show the sidebar" : "Hide the sidebar"}
        onClick={onToggleSidebar}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
      </button>
      {up && (
        <button
          type="button"
          title="Back"
          onClick={() => navigate(up)}
          className="flex size-7 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </button>
      )}
      <nav
        data-tauri-drag-region
        aria-label="You are here"
        className="flex h-full min-w-0 flex-1 items-center gap-1 text-sm"
      >
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />}
              {c.route && !last ? (
                <button
                  type="button"
                  onClick={() => navigate(c.route!)}
                  className="truncate rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {c.label}
                </button>
              ) : (
                <span className={cn("truncate px-1", last ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {c.label}
                </span>
              )}
            </Fragment>
          );
        })}
      </nav>
      <div
        data-tauri-drag-region
        className="hidden h-full shrink-0 items-center gap-2 text-xs text-muted-foreground md:flex"
      >
        {import.meta.env.DEV && (
          <span
            title="Development build — uses its own database (twig-dev.db)"
            className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
          >
            DEV
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-3.5" />
          {today()}
        </span>
        {activeYear && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">SY {activeYear.name}</span>
        )}
      </div>
      <WindowControls />
    </header>
  );
}
