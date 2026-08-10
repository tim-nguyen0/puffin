import { describe, expect, it } from "vitest";
import {
  fmuTopics,
  searchVehicles,
  statusFor,
  VEHICLES,
} from "./vehicleCatalog";

const x500 = VEHICLES.find((v) => v.model === "x500")!;
const tiltrotor = VEHICLES.find((v) => v.model === "tiltrotor")!;
const cessna = VEHICLES.find((v) => v.model === "rc_cessna")!;

describe("vehicle status", () => {
  it("marks the spawned vehicle spawned only while telemetry is live", () => {
    expect(statusFor(x500, true, "x500")).toBe("spawned");
    expect(statusFor(x500, false, "x500")).toBe("available");
  });

  it("keeps installed but unspawned airframes available", () => {
    expect(statusFor(cessna, true, "x500")).toBe("available");
  });

  it("follows the live model, so a replace re-tags both cards", () => {
    expect(statusFor(cessna, true, "rc_cessna")).toBe("spawned");
    expect(statusFor(x500, true, "rc_cessna")).toBe("available");
  });

  it("marks airframes missing from our px4 ref as not installed", () => {
    expect(statusFor(tiltrotor, true, "tiltrotor")).toBe("not-installed");
  });
});

describe("vehicle search", () => {
  it("matches name, model and category case-insensitively", () => {
    expect(searchVehicles(VEHICLES, "cessna")).toEqual([cessna]);
    expect(searchVehicles(VEHICLES, "VTOL").length).toBeGreaterThan(1);
    expect(searchVehicles(VEHICLES, "")).toEqual(VEHICLES);
  });
});

describe("fmu topic split", () => {
  it("splits live graph topics into published and subscribed", () => {
    const graph = {
      nodes: [],
      topics: [
        { name: "/fmu/out/vehicle_status_v1", type: "t", publishers: [], subscribers: [] },
        { name: "/fmu/in/vehicle_command", type: "t", publishers: [], subscribers: [] },
        { name: "/rosout", type: "t", publishers: [], subscribers: [] },
      ],
    };
    expect(fmuTopics(graph)).toEqual({
      published: ["/fmu/out/vehicle_status_v1"],
      subscribed: ["/fmu/in/vehicle_command"],
    });
  });

  it("returns empty lists with no graph", () => {
    expect(fmuTopics(undefined)).toEqual({ published: [], subscribed: [] });
  });
});
