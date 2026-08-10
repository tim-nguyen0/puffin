import { describe, expect, it } from "vitest";
import { qgcViewportUrl, simViewportUrl } from "./viewportUrl";

describe("public demo viewport urls", () => {
  it("proxies the gazebo stream on the page origin", () => {
    const url = simViewportUrl("https:", "demo.example");
    expect(url).toMatch(/^\/novnc\/vnc\.html\?/);
    expect(url).toContain("path=novnc/websockify");
  });

  it("proxies the qgc stream on the page origin", () => {
    const url = qgcViewportUrl("https:", "demo.example");
    expect(url).toMatch(/^\/qgc\/vnc\.html\?/);
    expect(url).toContain("path=qgc/websockify");
  });
});
