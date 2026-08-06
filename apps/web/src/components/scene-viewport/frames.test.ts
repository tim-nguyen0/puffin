import { describe, expect, it } from "vitest";
import { nedToScene, px4QuatToScene, rotateVec, type Quat } from "./frames";

const close = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i += 1) {
    expect(a[i]).toBeCloseTo(b[i], 6);
  }
};

describe("frames", () => {
  it("maps ned positions into the scene", () => {
    // 5 m up at 2 m north, 3 m east
    close(nedToScene(2, 3, -5), [3, 5, -2]);
  });

  it("keeps identity attitude level", () => {
    const q = px4QuatToScene([1, 0, 0, 0]);
    // scene nose is -z; identity keeps it there
    close(rotateVec(q, [0, 0, -1]), [0, 0, -1]);
    close(rotateVec(q, [0, 1, 0]), [0, 1, 0]);
  });

  it("turns a 90 degree ned yaw into nose-east", () => {
    const half = Math.SQRT1_2;
    // yaw +90 about ned z (down): body x ends up pointing east
    const yaw90: Quat = [half, 0, 0, half];
    const q = px4QuatToScene(yaw90);
    close(rotateVec(q, [0, 0, -1]), [1, 0, 0]);
  });

  it("rolls right without changing the nose", () => {
    const half = Math.SQRT1_2;
    // roll +90 about body x: the rotors end up facing east
    const roll90: Quat = [half, half, 0, 0];
    const q = px4QuatToScene(roll90);
    close(rotateVec(q, [0, 0, -1]), [0, 0, -1]);
    close(rotateVec(q, [0, 1, 0]), [1, 0, 0]);
  });
});
