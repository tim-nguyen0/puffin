import { qgcViewportUrl, simViewportUrl } from "./viewportUrl";
import "./sim-viewport.css";

const VARIANTS = {
  gazebo: { title: "Gazebo viewport", urlFor: simViewportUrl },
  qgc: { title: "QGroundControl viewport", urlFor: qgcViewportUrl },
};

interface SimViewportProps {
  // shown under the frame for streams that aren't wired up in this env yet
  // (e.g. qgc needs a sim image rebuild) - omit when the stream is solid.
  hint?: string;
  variant?: keyof typeof VARIANTS;
}

export function SimViewport({ hint, variant = "gazebo" }: SimViewportProps = {}) {
  const { title, urlFor } = VARIANTS[variant];
  const url = urlFor(window.location.protocol, window.location.hostname);
  return (
    <div className="sim-viewport">
      <iframe className="sim-viewport-frame" src={url} title={title} />
      <a className="sim-viewport-link" href={url} target="_blank" rel="noreferrer">
        Open full viewport ↗
      </a>
      {hint ? <p className="sim-viewport-hint">{hint}</p> : null}
    </div>
  );
}
