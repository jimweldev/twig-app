import { describe, expect, it } from "vitest";
import { fromPath, toPath, type Route } from "./router";

const ROUTES: Route[] = [
  { page: "dashboard" },
  { page: "schoolYears" },
  { page: "sections" },
  { page: "section", id: 3 },
  { page: "classRecords" },
  { page: "classSection", sectionId: 4 },
  { page: "class", id: 5, term: undefined },
  { page: "class", id: 5, term: 2 },
  { page: "attendance" },
  { page: "reportCards" },
  { page: "lessonPlans" },
  { page: "lessonPlan", id: 6 },
  { page: "quizzes" },
  { page: "quiz", id: 11 },
  { page: "certificates" },
  { page: "certificate", id: 7 },
  { page: "games" },
  { page: "game", game: "squad-up", sectionId: 8, classId: undefined, groupsId: undefined },
  { page: "game", game: "round-em-up", sectionId: 8, classId: 9, groupsId: 10 },
  { page: "settings" },
  { page: "settings", tab: "signatories" },
];

describe("routes as paths", () => {
  it.each(ROUTES.map((r) => [toPath(r), r] as const))("%s comes back as the same route", (path, route) => {
    const [pathname, search = ""] = path.split("?");
    expect(fromPath(pathname, search ? `?${search}` : "")).toEqual(route);
  });

  it("sends unknown or broken paths to the dashboard", () => {
    expect(fromPath("/nope")).toEqual({ page: "dashboard" });
    expect(fromPath("/class-records/abc")).toEqual({ page: "dashboard" });
    expect(fromPath("/games/chess/1")).toEqual({ page: "dashboard" });
  });
});
