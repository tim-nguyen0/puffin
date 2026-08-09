import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { FloatingTerminal } from "./components/floating-terminal/FloatingTerminal";
import { Sidebar } from "./components/sidebar/Sidebar";
import { TopBar } from "./components/topbar/TopBar";
import { useAuthStore } from "./lib/authStore";
import { SignupScreen } from "./screens/auth/SignupScreen";
import { DashboardScreen } from "./screens/dashboard/DashboardScreen";
import { LauncherScreen } from "./screens/launcher/LauncherScreen";
import { RosGraphScreen } from "./screens/ros-graph/RosGraphScreen";
import { ConsoleDashboardScreen } from "./screens/console-dashboard/ConsoleDashboardScreen";
import { RosServicesScreen } from "./screens/ros-services/RosServicesScreen";
import { SimulationScreen } from "./screens/simulation/SimulationScreen";
import { SettingsScreen } from "./screens/settings/SettingsScreen";
import { SensorsScreen } from "./screens/sensors/SensorsScreen";
import { VehiclesScreen } from "./screens/vehicles/VehiclesScreen";
import { MissionPlannerScreen } from "./screens/mission-planner/MissionPlannerScreen";

const SCREENS = [
  { path: "/dashboard", element: <DashboardScreen /> },
  { path: "/simulation", element: <SimulationScreen /> },
  { path: "/vehicles", element: <VehiclesScreen /> },
  { path: "/sensors", element: <SensorsScreen /> },
  { path: "/mission-planner", element: <MissionPlannerScreen /> },
  { path: "/ros-services", element: <RosServicesScreen /> },
  { path: "/ros-graph", element: <RosGraphScreen /> },
  { path: "/settings", element: <SettingsScreen /> },
];

function RequireAuth({ children }: { children: ReactNode }) {
  const { token, user, initialized } = useAuthStore();

  if (!initialized) return <p>Loading account...</p>;
  // the launch page is the login
  if (!token || !user) return <Navigate to="/" replace />;
  return children;
}

function AppShell() {
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
      <FloatingTerminal />
    </div>
  );
}

export function App() {
  const restore = useAuthStore((state) => state.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  return (
    <Routes>
      <Route path="/" element={<LauncherScreen />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/signup" element={<SignupScreen />} />
      <Route
        path="/dashboard/console"
        element={
          <RequireAuth>
            <main className="immersive-main">
              <ConsoleDashboardScreen />
            </main>
          </RequireAuth>
        }
      />
      <Route
        path="*"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
