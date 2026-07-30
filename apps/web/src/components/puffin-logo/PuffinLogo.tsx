import puffinMark from "../sidebar/assets/puffin-logo.png";
import "./puffin-logo.css";

export type PuffinLogoProps = {
  className?: string;
};

export function PuffinLogo({ className }: PuffinLogoProps) {
  const classes = ["puffin-logo", className].filter(Boolean).join(" ");

  return (
    <div className={classes} role="img" aria-label="Puffin">
      <img src={puffinMark} alt="" className="puffin-logo-mark" />
      <span className="puffin-logo-wordmark">Puffin</span>
    </div>
  );
}
