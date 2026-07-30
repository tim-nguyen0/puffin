import type { ButtonProps } from "./Button";
import { Button } from "./Button";
import { DroneIcon } from "./DroneIcon";

export type NewSimulationButtonProps = Omit<
  ButtonProps,
  "children" | "endIcon" | "startIcon"
>;

export function NewSimulationButton({ className, ...props }: NewSimulationButtonProps) {
  const classes = ["new-simulation-button", className].filter(Boolean).join(" ");

  return (
    <Button {...props} className={classes} endIcon={<DroneIcon />}>
      New Simulation Environment
    </Button>
  );
}
