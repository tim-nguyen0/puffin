import { Route, Routes, useLocation } from "react-router-dom";
import { Sidebar } from "./components/sidebar/Sidebar";
import { DashboardScreen } from "./screens/dashboard/DashboardScreen";
import { LauncherScreen } from "./screens/launcher/LauncherScreen";
import { RosGraphScreen } from "./screens/ros-graph/RosGraphScreen";
import { RosServicesScreen } from "./screens/ros-services/RosServicesScreen";

const SCREENS = [
  { path: "/", element: <LauncherScreen /> },
  { path: "/dashboard", element: <DashboardScreen /> },
  { path: "/ros-services", element: <RosServicesScreen /> },
  { path: "/ros-graph", element: <RosGraphScreen /> },
];

export function App() {
  const { pathname } = useLocation();
  const isLaunchPage = pathname === "/";

  return (
    <div className={isLaunchPage ? "launch-app-shell" : "app-shell"}>
      {!isLaunchPage ? <Sidebar /> : null}
      <main className={isLaunchPage ? "launch-main" : undefined}>
        <Routes>
          {SCREENS.map((screen) => (
            <Route key={screen.path} path={screen.path} element={screen.element} />
          ))}
        </Routes>
      </main>
    </div>
  );
}
