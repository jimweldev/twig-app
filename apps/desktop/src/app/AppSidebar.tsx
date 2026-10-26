import type { LucideIcon } from "lucide-react";
import {
  Award,
  CalendarCheck,
  CalendarRange,
  ClipboardList,
  FileText,
  Gamepad2,
  LayoutDashboard,
  NotebookPen,
  School,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useRouter, type Route } from "./router";
import { useSchool } from "./school";

interface NavItem {
  label: string;
  icon: LucideIcon;
  route: Route;
  /** Routes that keep this item highlighted. */
  pages: Route["page"][];
  soon?: boolean;
}

const MAIN: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, route: { page: "dashboard" }, pages: ["dashboard"] },
  { label: "School years", icon: CalendarRange, route: { page: "schoolYears" }, pages: ["schoolYears"] },
  { label: "Sections", icon: Users, route: { page: "sections" }, pages: ["sections", "section"] },
  {
    label: "Class records",
    icon: ClipboardList,
    route: { page: "classRecords" },
    pages: ["classRecords", "classSection", "class"],
  },
  { label: "Attendance", icon: CalendarCheck, route: { page: "attendance" }, pages: ["attendance"] },
  { label: "Report cards", icon: FileText, route: { page: "reportCards" }, pages: ["reportCards"] },
];

const LATER: NavItem[] = [
  { label: "Lesson plans", icon: NotebookPen, route: { page: "lessonPlans" }, pages: ["lessonPlans"], soon: true },
  { label: "Certificates", icon: Award, route: { page: "certificates" }, pages: ["certificates"], soon: true },
  { label: "Games", icon: Gamepad2, route: { page: "games" }, pages: ["games"], soon: true },
];

export function AppSidebar() {
  const { route, navigate } = useRouter();
  const { activeYear, profile } = useSchool();

  const renderItems = (items: NavItem[]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.label}>
        <SidebarMenuButton
          isActive={item.pages.includes(route.page)}
          tooltip={item.label}
          onClick={() => navigate(item.route)}
        >
          <item.icon />
          <span>{item.label}</span>
        </SidebarMenuButton>
        {item.soon && <SidebarMenuBadge className="text-[10px] text-muted-foreground">Soon</SidebarMenuBadge>}
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" onClick={() => navigate({ page: "dashboard" })}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
                T
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="flex items-center gap-1.5 font-bold tracking-tight">
                  TWIG
                  {import.meta.env.DEV && (
                    <span
                      title="Development build — uses its own database (twig-dev.db)"
                      className="rounded bg-amber-100 px-1 py-px text-[10px] font-semibold tracking-normal text-amber-800"
                    >
                      DEV
                    </span>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {activeYear ? `SY ${activeYear.name}` : "No active school year"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(MAIN)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Coming soon</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(LATER)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              isActive={route.page === "profile"}
              tooltip="School profile"
              onClick={() => navigate({ page: "profile" })}
            >
              <School />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-medium">{profile?.teacher_name || "Set up your profile"}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {profile?.school_name || "School profile"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
