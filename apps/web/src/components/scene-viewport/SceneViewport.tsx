import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useTelemetryStore } from "../../lib/telemetryStore";
import { nedToScene, px4QuatToScene } from "./frames";
import "./scene-viewport.css";

// colors mirror the console design tokens (three cannot read css vars):
// --color-graph-bg, --color-graph-border, --color-service-blue,
// --color-service-cyan, --color-discovery
const COLORS = {
  bg: 0x0d1726,
  grid: 0x243a57,
  gridCenter: 0x526d8d,
  body: 0x338eff,
  rotor: 0x16d9cf,
  shadow: 0x28c98b,
};

function buildDrone(): THREE.Group {
  const drone = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: COLORS.body });
  const rotorMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.rotor,
    transparent: true,
    opacity: 0.85,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.34), bodyMaterial);
  drone.add(body);

  // nose marker: scene body frame has the nose toward -z
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 12), bodyMaterial);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0, -0.26);
  drone.add(nose);

  for (const [dx, dz] of [
    [0.32, -0.32],
    [0.32, 0.32],
    [-0.32, 0.32],
    [-0.32, -0.32],
  ]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.42), bodyMaterial);
    arm.position.set(dx / 2, 0, dz / 2);
    arm.rotation.y = Math.atan2(dx, dz) + Math.PI;
    drone.add(arm);
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 20), rotorMaterial);
    rotor.position.set(dx, 0.05, dz);
    drone.add(rotor);
  }
  return drone;
}

const HOME_OFFSET = new THREE.Vector3(5.5, 4, 5.5);

export function SceneViewport() {
  const mount = useRef<HTMLDivElement>(null);
  const resetView = useRef<(() => void) | null>(null);
  const connected = useTelemetryStore((state) => state.connected);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.bg);
    scene.fog = new THREE.Fog(COLORS.bg, 18, 42);

    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
    camera.position.copy(HOME_OFFSET);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    // orbit around the drone; clamps keep every reachable view sane, so
    // there is no "lost in the void" state to recover from
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    resetView.current = () => {
      camera.position.copy(controls.target).add(HOME_OFFSET);
    };

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(6, 10, 4);
    scene.add(sun);

    scene.add(new THREE.GridHelper(60, 60, COLORS.gridCenter, COLORS.grid));

    const drone = buildDrone();
    scene.add(drone);

    // ground marker under the vehicle: altitude at a glance
    const shadow = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.3, 24),
      new THREE.MeshBasicMaterial({
        color: COLORS.shadow,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    scene.add(shadow);

    const dronePosition = new THREE.Vector3(0, 0, 0);
    const droneQuat = new THREE.Quaternion();

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame = 0;
    const tick = () => {
      const latest = useTelemetryStore.getState().latest;
      if (latest) {
        const [x, y, z] = nedToScene(latest.ned.x, latest.ned.y, latest.ned.z);
        dronePosition.set(x, Math.max(y, 0.06), z);
        const [w, qx, qy, qz] = px4QuatToScene(
          latest.attitude_q as [number, number, number, number],
        );
        droneQuat.set(qx, qy, qz, w);
      }
      drone.position.lerp(dronePosition, 0.12);
      drone.quaternion.slerp(droneQuat, 0.18);
      shadow.position.x = drone.position.x;
      shadow.position.z = drone.position.z;

      // the camera orbits whatever it follows; keep the pivot on the drone
      controls.target.lerp(drone.position, 0.12);
      controls.update();

      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      resetView.current = null;
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material as THREE.Material | THREE.Material[];
          for (const m of Array.isArray(material) ? material : [material]) m.dispose();
        }
      });
      host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="scene-viewport">
      <div ref={mount} className="scene-viewport-canvas" />
      <span className={`scene-viewport-hint${connected ? " is-live" : ""}`}>
        {connected ? "● live telemetry render" : "○ waiting for telemetry"}
      </span>
      <button
        type="button"
        className="scene-viewport-reset"
        onClick={() => resetView.current?.()}
        title="Reset view"
      >
        ⌂ view
      </button>
    </div>
  );
}
