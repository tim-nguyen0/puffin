import { useNavigate } from "react-router-dom";
import { NewSimulationButton } from "../../components/button";
import { PuffinLogo } from "../../components/puffin-logo";
import { RecentFolders } from "../../components/recent-folders";
import "./launcher.css";

const RECENT_FOLDERS = [
  { id: "rospackage-1", name: "rospackage-1" },
  { id: "rospackage-2", name: "rospackage-2" },
  { id: "rospackage-3", name: "rospackage-3" },
];

export function LauncherScreen() {
  const navigate = useNavigate();

  return (
    <section className="launcher-screen" aria-label="Puffin launch page">
      <PuffinLogo />
      {/* placeholder until session creation exists - straight to the dashboard */}
      <NewSimulationButton onClick={() => navigate("/dashboard")} />
      <RecentFolders folders={RECENT_FOLDERS} />
    </section>
  );
}
