import { describe, expect, it } from "vitest";
import { nedToScene } from "../scene-viewport/frames";
import { clampGroundZ, roundM, sceneToNed } from "./sceneFrames";

const close = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i += 1) {
    expect(a[i]).toBeCloseTo(b[i], 6);
  }
};

const NED_SAMPLES: [number, number, number][] = [
  [0, 0, 0],
  [2, 3, -5],
  [-10, 10, -1],
  [12.5, -4.25, -3.5],
];

describe("sceneToNed", () => {
  it("undoes the frames.ts example", () => {
    // frames.test.ts: 5 m up at 2 m north, 3 m east -> [3, 5, -2]
    close(sceneToNed(3, 5, -2), [2, 3, -5]);
  });

  it("round-trips every ned sample through the scene frame", () => {
    for (const [north, east, down] of NED_SAMPLES) {
      const [x, y, z] = nedToScene(north, east, down);
      close(sceneToNed(x, y, z), [north, east, down]);
    }
  });

  it("round-trips scene vectors through ned", () => {
    for (const [x, y, z] of [
      [1, 2, 3],
      [-6, 0.5, 7.25],
    ]) {
      const [north, east, down] = sceneToNed(x, y, z);
      close(nedToScene(north, east, down), [x, y, z]);
    }
  });

  it("keeps north on -z and altitude on +y", () => {
    // one metre "into the screen" is one metre north; one metre up is -1 down
    close(sceneToNed(0, 0, -1), [1, 0, 0]);
    close(sceneToNed(0, 1, 0), [0, 0, -1]);
  });
});

describe("roundM", () => {
  it("snaps to a tenth of a metre", () => {
    expect(roundM(4.06)).toBe(4.1);
    expect(roundM(-4.06)).toBe(-4.1);
    expect(roundM(10)).toBe(10);
  });

  it("never emits negative zero", () => {
    expect(Object.is(roundM(-0.02), 0)).toBe(true);
  });
});

describe("clampGroundZ", () => {
  it("keeps waypoints above ground", () => {
    expect(clampGroundZ(0)).toBe(-1);
    expect(clampGroundZ(4)).toBe(-1);
    expect(clampGroundZ(-0.4)).toBe(-1);
  });

  it("leaves airborne altitudes alone", () => {
    expect(clampGroundZ(-1)).toBe(-1);
    expect(clampGroundZ(-12.5)).toBe(-12.5);
  });
});
