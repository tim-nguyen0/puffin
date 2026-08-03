import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GraphFilterBar } from "./GraphFilterBar";
import { GraphLayoutToggle } from "./GraphLayoutToggle";

describe("GraphLayoutToggle", () => {
  it("renders both layouts and marks the selected option", () => {
    const markup = renderToStaticMarkup(
      createElement(GraphLayoutToggle, {
        value: "hierarchical",
        onChange: () => undefined,
      }),
    );

    expect(markup).toContain('aria-label="Graph layout"');
    expect(markup).toContain("Hierarchical");
    expect(markup).toContain("Force-Directed");
    expect(markup).toContain('aria-pressed="true"');
  });
});

describe("GraphFilterBar", () => {
  it("composes the reusable filter, search, layout, and refresh controls", () => {
    const markup = renderToStaticMarkup(
      createElement(GraphFilterBar, {
        visibility: "ros",
        onVisibilityChange: () => undefined,
        search: "",
        onSearchChange: () => undefined,
        layout: "force-directed",
        onLayoutChange: () => undefined,
        isRefreshing: false,
        onRefresh: () => undefined,
      }),
    );

    expect(markup).toContain("ROS system only");
    expect(markup).toContain("Search services, interfaces…");
    expect(markup).toContain("Force-Directed");
    expect(markup).toContain('aria-label="Refresh graph"');
  });
});
