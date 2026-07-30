import { Route, Routes, useLocation } from "react-router-dom";
import { Sidebar } from "./components/sidebar/Sidebar";
import { ConsoleDashboardScreen } from "./screens/console-dashboard/ConsoleDashboardScreen";
import { DashboardScreen } from "./screens/dashboard/DashboardScreen";
import { LauncherScreen } from "./screens/launcher/LauncherScreen";
import { RosGraphScreen } from "./screens/ros-graph/RosGraphScreen";
import { RosServicesScreen } from "./screens/ros-services/RosServicesScreen";
import { SimulationScreen } from "./screens/simulation/SimulationScreen";

const SCREENS = [
  { path: "/", element: <LauncherScreen /> },
  { path: "/dashboard", element: <DashboardScreen /> },
  { path: "/dashboard/console", element: <ConsoleDashboardScreen /> },
  { path: "/simulation", element: <SimulationScreen /> },
  { path: "/ros-services", element: <RosServicesScreen /> },
  { path: "/ros-graph", element: <RosGraphScreen /> },
];

export function App() {
  const { pathname } = useLocation();
  const isLaunchPage = pathname === "/";
  const isImmersivePage = pathname === "/dashboard/console";
  const hasStandaloneShell = isLaunchPage || isImmersivePage;

  return (
    <div className={hasStandaloneShell ? "launch-app-shell" : "app-shell"}>
      {!hasStandaloneShell ? <Sidebar /> : null}
      <main
        className={
          isLaunchPage ? "launch-main" : isImmersivePage ? "immersive-main" : undefined
        }
      >
        <Routes>
          {SCREENS.map((screen) => (
            <Route key={screen.path} path={screen.path} element={screen.element} />
          ))}
        </Routes>
      </main>
    </div>
  );
}
