import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { FloatingTerminal } from "./components/floating-terminal/FloatingTerminal";
import { Sidebar } from "./components/sidebar/Sidebar";
import { TopBar } from "./components/topbar/TopBar";
import { useAuthStore } from "./lib/authStore";
import { LoginScreen } from "./screens/auth/LoginScreen";
import { SignupScreen } from "./screens/auth/SignupScreen";
import { DashboardScreen } from "./screens/dashboard/DashboardScreen";
import { LauncherScreen } from "./screens/launcher/LauncherScreen";
import { RosGraphScreen } from "./screens/ros-graph/RosGraphScreen";
import { RosServicesScreen } from "./screens/ros-services/RosServicesScreen";
import { SettingsScreen } from "./screens/settings/SettingsScreen";

const SCREENS = [
  { path: "/", element: <LauncherScreen /> },
  { path: "/dashboard", element: <DashboardScreen /> },
  { path: "/ros-services", element: <RosServicesScreen /> },
  { path: "/ros-graph", element: <RosGraphScreen /> },
  { path: "/settings", element: <SettingsScreen /> },
];

function RequireAuth({ children }: { children: ReactNode }) {
  const { token, user, initialized } = useAuthStore();

  if (!initialized) return <p>Loading account...</p>;
  if (!token || !user) return <Navigate to="/login" replace />;
  return children;
}

function AppShell() {
  const { pathname } = useLocation();
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

export function App() {
  const restore = useAuthStore((state) => state.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/signup" element={<SignupScreen />} />
      <Route path="*" element={<RequireAuth><AppShell /></RequireAuth>} />
    </Routes>
  );
}
