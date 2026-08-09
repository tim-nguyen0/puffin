import { describe, expect, it } from "vitest";
import {
  actionsForState,
  metaForNode,
  toneForState,
  transitionForAction,
} from "./serviceNodes";

describe("service node mapping", () => {
  it("maps lifecycle states onto the design's tones", () => {
    expect(toneForState("active")).toBe("running");
    expect(toneForState("inactive")).toBe("armed");
    expect(toneForState("unconfigured")).toBe("stopped");
    expect(toneForState("finalized")).toBe("stopped");
    expect(toneForState(undefined)).toBe("stopped");
  });

  it("offers only legal actions per state", () => {
    expect(actionsForState("unconfigured")).toEqual(["arm"]);
    expect(actionsForState("inactive")).toEqual(["run", "stop"]);
    expect(actionsForState("active")).toEqual(["stop"]);
    expect(actionsForState("unknown")).toEqual([]);
  });

  it("resolves each action to one legal transition", () => {
    expect(transitionForAction("arm", "unconfigured")).toBe("configure");
    expect(transitionForAction("run", "inactive")).toBe("activate");
    expect(transitionForAction("stop", "active")).toBe("deactivate");
    expect(transitionForAction("stop", "inactive")).toBe("cleanup");
    expect(transitionForAction("run", "active")).toBeNull();
  });

  it("knows the shipped nodes and degrades for strangers", () => {
    expect(metaForNode("/offboard_demo").package).toBe("offboard_demo");
    expect(metaForNode("/teleop").executable).toBe("teleop_node");
    expect(metaForNode("/mystery").package).toBe("—");
  });
});
