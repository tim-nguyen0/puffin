import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { DroneIcon } from "./DroneIcon";
import { NewSimulationButton } from "./NewSimulationButton";

describe("Button", () => {
  it("defaults to a non-submitting button and renders an end icon", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Button,
        {
          children: "New Simulation Environment",
          endIcon: createElement(DroneIcon),
        },
      ),
    );

    expect(markup).toContain('type="button"');
    expect(markup).toContain("New Simulation Environment");
    expect(markup).toContain('class="puffin-button-icon"');
  });

  it("forwards native button props and custom classes", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Button,
        {
          children: "Save",
          className: "screen-action",
          disabled: true,
          type: "submit",
        },
      ),
    );

    expect(markup).toContain('class="puffin-button screen-action"');
    expect(markup).toContain('type="submit"');
    expect(markup).toContain("disabled");
  });
});

describe("NewSimulationButton", () => {
  it("provides the reference label and decorative drone icon", () => {
    const markup = renderToStaticMarkup(createElement(NewSimulationButton));

    expect(markup).toContain("New Simulation Environment");
    expect(markup).toContain('class="puffin-button new-simulation-button"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("<svg");
  });
});
