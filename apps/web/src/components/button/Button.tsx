import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./button.css";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  endIcon?: ReactNode;
  startIcon?: ReactNode;
};

export function Button({
  children,
  className,
  endIcon,
  startIcon,
  type = "button",
  ...buttonProps
}: ButtonProps) {
  const classes = ["puffin-button", className].filter(Boolean).join(" ");

  return (
    <button className={classes} type={type} {...buttonProps}>
      {startIcon ? (
        <span className="puffin-button-icon" aria-hidden="true">
          {startIcon}
        </span>
      ) : null}
      <span className="puffin-button-label">{children}</span>
      {endIcon ? (
        <span className="puffin-button-icon" aria-hidden="true">
          {endIcon}
        </span>
      ) : null}
    </button>
  );
}
