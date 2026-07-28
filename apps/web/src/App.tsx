import { Route, Routes } from "react-router-dom";
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
  return (
    <div className="app-shell">
      <Sidebar />
      <main>
        <Routes>
          {SCREENS.map((screen) => (
            <Route key={screen.path} path={screen.path} element={screen.element} />
          ))}
        </Routes>
      </main>
    </div>
  );
}
