import { describe, expect, it } from "vitest";
import { qgcViewportUrl, simViewportUrl } from "./viewportUrl";

describe("sim viewport url", () => {
  it("serves the full gazebo stream from 6080", () => {
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

describe("qgc viewport url", () => {
  it("serves the qgroundcontrol stream from 6081", () => {
    expect(qgcViewportUrl("http:", "localhost")).toBe(
      "http://localhost:6081/vnc.html?autoconnect=true&resize=scale&reconnect=true",
    );
  });

  it("keeps the page protocol", () => {
    expect(qgcViewportUrl("https:", "puffin.test")).toBe(
      "https://puffin.test:6081/vnc.html?autoconnect=true&resize=scale&reconnect=true",
    );
  });
});
