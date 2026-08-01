import { describe, expect, it } from "vitest";
import { simViewportUrl } from "./viewportUrl";

describe("sim viewport url", () => {
  it("targets novnc on port 6080 of the same host", () => {
    expect(simViewportUrl("http:", "localhost")).toBe(
      "http://localhost:6080/vnc.html?autoconnect=true&resize=scale&reconnect=true",
    );
  });

  it("keeps the page protocol", () => {
    expect(simViewportUrl("https:", "puffin.test")).toBe(
      "https://puffin.test:6080/vnc.html?autoconnect=true&resize=scale&reconnect=true",
    );
  });
});
