import { NavLink, Route, Routes } from "react-router-dom";
import { DashboardScreen } from "./screens/dashboard/DashboardScreen";
import { LauncherScreen } from "./screens/launcher/LauncherScreen";
import { RosGraphScreen } from "./screens/ros-graph/RosGraphScreen";
import { RosServicesScreen } from "./screens/ros-services/RosServicesScreen";

const SCREENS = [
  { path: "/", label: "Launcher", element: <LauncherScreen /> },
  { path: "/dashboard", label: "Dashboard", element: <DashboardScreen /> },
  { path: "/ros-services", label: "ROS Services", element: <RosServicesScreen /> },
  { path: "/ros-graph", label: "ROS Graph", element: <RosGraphScreen /> },
];

export function App() {
  return (
    <>
      <nav>
        {SCREENS.map((screen) => (
          <NavLink key={screen.path} to={screen.path} end={screen.path === "/"}>
            {screen.label}
          </NavLink>
        ))}
      </nav>
      <main>
        <Routes>
          {SCREENS.map((screen) => (
            <Route key={screen.path} path={screen.path} element={screen.element} />
          ))}
        </Routes>
      </main>
    </>
  );
}
