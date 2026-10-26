import { createContext, useContext, useState, type ReactNode } from "react";

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
  | { page: "certificates" }
  | { page: "games" }
  | { page: "profile" };

interface RouterValue {
  route: Route;
  navigate: (route: Route) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

/** In-memory navigation; a desktop app has no URL bar to sync with. */
export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>({ page: "dashboard" });
  return <RouterContext.Provider value={{ route, navigate: setRoute }}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used inside RouterProvider");
  return ctx;
}
