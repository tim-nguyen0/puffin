import { describe, expect, it } from "vitest";
import { simViewportUrl } from "./viewportUrl";

describe("sim viewport url", () => {
  it("defaults to the full gazebo stream on 6080", () => {
    expect(simViewportUrl("http:", "localhost")).toBe(
      "http://localhost:6080/vnc.html?autoconnect=true&resize=scale&reconnect=true",
    );
  });

  it("serves the chrome-free scene from 6081", () => {
    expect(simViewportUrl("https:", "puffin.test", "clean")).toBe(
      "https://puffin.test:6081/vnc.html?autoconnect=true&resize=scale&reconnect=true",
    );
  });
});
