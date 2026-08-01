import { simViewportUrl } from "./viewportUrl";
import "./sim-viewport.css";

export function SimViewport() {
  const url = simViewportUrl(window.location.protocol, window.location.hostname);
  return (
    <div className="sim-viewport">
      <iframe className="sim-viewport-frame" src={url} title="Gazebo viewport" />
      <a className="sim-viewport-link" href={url} target="_blank" rel="noreferrer">
        Open full viewport ↗
      </a>
    </div>
  );
}
