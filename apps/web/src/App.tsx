import { SettingsScreen } from "./screens/settings/SettingsScreen";
import { Route, Routes, useLocation } from "react-router-dom";
import { FloatingTerminal } from "./components/floating-terminal/FloatingTerminal";
import { Sidebar } from "./components/sidebar/Sidebar";
import { TopBar } from "./components/topbar/TopBar";
import { DashboardScreen } from "./screens/dashboard/DashboardScreen";
import { LauncherScreen } from "./screens/launcher/LauncherScreen";
import { RosGraphScreen } from "./screens/ros-graph/RosGraphScreen";
import { RosServicesScreen } from "./screens/ros-services/RosServicesScreen";

const SCREENS = [
  { path: "/", element: <LauncherScreen /> },
  { path: "/dashboard", element: <DashboardScreen /> },
  { path: "/ros-services", element: <RosServicesScreen /> },
  { path: "/ros-graph", element: <RosGraphScreen /> },
  { path: "/settings", element: <SettingsScreen /> },
];

export function App() {
  const { pathname } = useLocation();
  // the launcher is a full-page screen: no sidebar, no topbar, light bg
  const isLaunchPage = pathname === "/";

  return (
    <div className={isLaunchPage ? "app-shell launch-app-shell" : "app-shell"}>
      {!isLaunchPage && <Sidebar />}
      <div className="workspace">
        {!isLaunchPage && <TopBar />}
        <main className={isLaunchPage ? "launch-main" : undefined}>
          <Routes>
            {SCREENS.map((screen) => (
              <Route key={screen.path} path={screen.path} element={screen.element} />
            ))}
          </Routes>
        </main>
      </div>
      <FloatingTerminal />
    </div>
  );
}
