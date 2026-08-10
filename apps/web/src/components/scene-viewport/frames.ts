// frame conversions for the client-side viewport. pure math, no three
// dependency, so it tests anywhere.
//
// scene frame is three.js convention: x east, y up, z south.
// ned frame is px4 convention: x north, y east, z down.

export type Quat = [number, number, number, number]; // [w, x, y, z]
export type Vec3 = [number, number, number];

export function nedToScene(north: number, east: number, down: number): Vec3 {
  return [east, -down, -north];
}

// the ned->scene basis as a quaternion, derived once from the rotation
// matrix rows: scene_x = E, scene_y = -D, scene_z = -N (det +1)
const NED_TO_SCENE: Quat = matrixToQuat([
  [0, 1, 0],
  [0, 0, -1],
  [-1, 0, 0],
]);

function matrixToQuat(m: number[][]): Quat {
  const trace = m[0][0] + m[1][1] + m[2][2];
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return [s / 4, (m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s];
  }
  if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
    const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2;
    return [(m[2][1] - m[1][2]) / s, s / 4, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s];
  }
  if (m[1][1] > m[2][2]) {
    const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2;
    return [(m[0][2] - m[2][0]) / s, (m[0][1] + m[1][0]) / s, s / 4, (m[1][2] + m[2][1]) / s];
  }
  const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2;
  return [(m[1][0] - m[0][1]) / s, (m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, s / 4];
}

export function quatMultiply(a: Quat, b: Quat): Quat {
  const [aw, ax, ay, az] = a;
  const [bw, bx, by, bz] = b;
  return [
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
  ];
}

export function quatConjugate(q: Quat): Quat {
  return [q[0], -q[1], -q[2], -q[3]];
}

// px4's attitude rotates body FRD into NED; conjugating by the basis
// change gives the same physical rotation in scene coordinates. the
// drone model is built in the equivalently-mapped body frame (nose -z,
// right +x, rotors +y).
export function px4QuatToScene(q: Quat): Quat {
  return quatMultiply(quatMultiply(NED_TO_SCENE, q), quatConjugate(NED_TO_SCENE));
}

export function rotateVec(q: Quat, v: Vec3): Vec3 {
  const [w, x, y, z] = q;
  const [vx, vy, vz] = v;
  // v' = q v q*
  const uvx = y * vz - z * vy;
  const uvy = z * vx - x * vz;
  const uvz = x * vy - y * vx;
  const uuvx = y * uvz - z * uvy;
  const uuvy = z * uvx - x * uvz;
  const uuvz = x * uvy - y * uvx;
  return [
    vx + 2 * (w * uvx + uuvx),
    vy + 2 * (w * uvy + uuvy),
    vz + 2 * (w * uvz + uuvz),
  ];
}
