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
  const isLaunchPage = pathname === "/";

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="workspace">
        <TopBar />
        <main>
          <Routes>
            {SCREENS.map((screen) => (
              <Route key={screen.path} path={screen.path} element={screen.element} />
            ))}
          </Routes>
        </main>
      </div>
    </div>
  );
}
