import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusTag } from "./StatusTag";

describe("StatusTag", () => {
  it("renders the status tone as reusable badge styling", () => {
    const markup = renderToStaticMarkup(
      createElement(StatusTag, { status: "running" }),
    );

    expect(markup).toContain("status-tag-running");
    expect(markup).toContain("running");
  });

  it("supports a custom label without a dot", () => {
    const markup = renderToStaticMarkup(
      createElement(StatusTag, {
        label: "current",
        showDot: false,
        status: "running",
      }),
    );

    expect(markup).toContain("current");
    expect(markup).not.toContain("<i");
  });
});
