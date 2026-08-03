import { describe, expect, it } from "vitest";
import { simViewportUrl } from "./viewportUrl";

describe("sim viewport url (public demo build)", () => {
  it("serves the full gazebo stream from the same-origin proxy", () => {
    const url = simViewportUrl();
    expect(url.startsWith("/novnc/vnc.html?")).toBe(true);
    expect(url).toContain("path=novnc/websockify");
  });

  it("serves the chrome-free scene from its own proxy path", () => {
    const url = simViewportUrl("clean");
    expect(url.startsWith("/novnc-clean/vnc.html?")).toBe(true);
    expect(url).toContain("path=novnc-clean/websockify");
  });
});
