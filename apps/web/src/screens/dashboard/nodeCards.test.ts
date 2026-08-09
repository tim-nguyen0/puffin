import { describe, expect, it } from "vitest";
import { describeNode, healthSummary, isForgeCandidate } from "./nodeCards";

describe("isForgeCandidate", () => {
  it("skips the nodes that ship with the stack", () => {
    expect(isForgeCandidate("/offboard_demo")).toBe(false);
    expect(isForgeCandidate("/teleop")).toBe(false);
  });

  it("flags anything the metadata map has never heard of", () => {
    expect(isForgeCandidate("/patrol")).toBe(true);
  });
});

describe("describeNode", () => {
  it("describes a finished build as a forged mission node", () => {
    expect(describeNode("/patrol", "done").description).toContain("forged mission node");
  });

  it("keeps the generic description until the build finishes", () => {
    expect(describeNode("/patrol", "building").description).toBe("ros 2 lifecycle node");
    expect(describeNode("/patrol", undefined).description).toBe("ros 2 lifecycle node");
  });

  it("never overrides a known node", () => {
    expect(describeNode("/teleop", undefined).package).toBe("offboard_demo");
  });
});

describe("healthSummary", () => {
  const proc = (name: string, state: "RUNNING" | "FATAL") => ({ name, state, uptime_s: 1 });

  it("counts only running programs", () => {
    expect(healthSummary([proc("gz-server", "RUNNING"), proc("px4", "FATAL")])).toEqual({
      running: 1,
      total: 2,
      healthy: false,
    });
  });

  it("is healthy when every program is up", () => {
    expect(healthSummary([proc("px4", "RUNNING")]).healthy).toBe(true);
  });

  it("treats an empty roster as unhealthy", () => {
    expect(healthSummary([])).toEqual({ running: 0, total: 0, healthy: false });
  });
});
