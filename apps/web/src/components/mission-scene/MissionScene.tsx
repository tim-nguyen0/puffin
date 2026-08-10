import { useEffect, useRef, type JSX } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { components } from "@puffin/api-types";
import { nedToScene } from "../scene-viewport/frames";
import { clampGroundZ, roundM, sceneToNed } from "./sceneFrames";
import "./mission-scene.css";

type Waypoint = components["schemas"]["Waypoint"];

export interface MissionSceneProps {
  waypoints: Waypoint[];
  takeoffZ: number;
  returnToOrigin: boolean;
  drone: { x: number; y: number; z: number } | null;
  activeIndex: number | null;
  onChange: (index: number, wp: Waypoint) => void;
}

// colors mirror the console design tokens (three cannot read css vars):
// --color-graph-bg, --color-graph-border, --color-graph-link,
// --color-service-blue, --color-service-cyan, --color-service-amber,
// --color-discovery, --color-graph-text
const COLORS = {
  bg: 0x0d1726,
  grid: 0x243a57,
  gridCenter: 0x526d8d,
  path: 0x338eff,
  waypoint: 0x16d9cf,
  active: 0xffad1f,
  origin: 0x28c98b,
  drone: 0xf5f8ff,
  label: 0xf5f8ff,
};

const GRID_SPAN_M = 100;
const GRID_CELLS = 20; // 5 m cells
const MARKER_RADIUS_M = 0.6;
const LABEL_TEXTURE_PX = 128;
const LABEL_SCALE_M = 1.6;
const LABEL_LIFT_M = 1.5;
const DRONE_FLOOR_M = 0.2; // keep the live marker off the grid when landed
const HOME_OFFSET = new THREE.Vector3(17, 14, 17);
const UP = new THREE.Vector3(0, 1, 0);
const HINT = "drag = move · shift+drag = altitude · grid 5 m · ned";

const cssHex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

function buildLabel(n: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_TEXTURE_PX;
  canvas.height = LABEL_TEXTURE_PX;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = cssHex(COLORS.label);
    ctx.font = `bold ${LABEL_TEXTURE_PX * 0.62}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), LABEL_TEXTURE_PX / 2, LABEL_TEXTURE_PX / 2);
  }
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthTest: false, // numbers stay readable behind the path and markers
    }),
  );
  sprite.scale.setScalar(LABEL_SCALE_M);
  sprite.position.set(0, LABEL_LIFT_M, 0);
  sprite.renderOrder = 2;
  return sprite;
}

// a line whose vertex count changes every frame: keep one growable buffer
// instead of rebuilding geometry, and skip culling since bounds would lie
function createPolyline(object: THREE.Line | THREE.LineSegments) {
  const geometry = object.geometry;
  let capacity = 0;
  let count = 0;
  const reserve = (points: number) => {
    if (points <= capacity) return;
    capacity = Math.max(points, 64);
    const attribute = new THREE.BufferAttribute(new Float32Array(capacity * 3), 3);
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", attribute);
  };
  reserve(64);
  object.frustumCulled = false;
  const position = () => geometry.getAttribute("position") as THREE.BufferAttribute;
  return {
    begin(points: number) {
      reserve(points);
      count = 0;
    },
    push(x: number, y: number, z: number) {
      position().setXYZ(count, x, y, z);
      count += 1;
    },
    end() {
      position().needsUpdate = true;
      geometry.setDrawRange(0, count);
    },
  };
}

interface Marker {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
}

type DragMode = "plane" | "altitude";

interface Drag {
  index: number;
  mode: DragMode;
  pointerId: number;
}

export function MissionScene(props: MissionSceneProps): JSX.Element {
  const mount = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const resetView = useRef<(() => void) | null>(null);
  // the render loop and the pointer handlers read props through a ref, so new
  // props never tear down the scene or interrupt a drag in flight
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const host = mount.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.bg);
    scene.fog = new THREE.Fog(COLORS.bg, 70, 200);

    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 500);
    camera.position.copy(HOME_OFFSET);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    // orbit around the pad; clamps match the drone viewport except for reach,
    // since a mission can spread further than a follow camera ever needs to
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 120;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    resetView.current = () => {
      camera.position.copy(controls.target).add(HOME_OFFSET);
    };

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(6, 12, 4);
    scene.add(sun);

    scene.add(new THREE.GridHelper(GRID_SPAN_M, GRID_CELLS, COLORS.gridCenter, COLORS.grid));

    // the pad at ned origin
    const origin = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.85, 28),
      new THREE.MeshBasicMaterial({
        color: COLORS.origin,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
      }),
    );
    origin.rotation.x = -Math.PI / 2;
    origin.position.y = 0.02;
    scene.add(origin);

    const pathObject = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: COLORS.path }),
    );
    scene.add(pathObject);
    const path = createPolyline(pathObject);

    const stalkObject = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: COLORS.waypoint, transparent: true, opacity: 0.35 }),
    );
    scene.add(stalkObject);
    const stalks = createPolyline(stalkObject);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(MARKER_RADIUS_M * 1.7, 0.07, 10, 36),
      new THREE.MeshBasicMaterial({ color: COLORS.active }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.visible = false;
    scene.add(halo);

    const drone = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45),
      new THREE.MeshStandardMaterial({ color: COLORS.drone, emissive: COLORS.drone, emissiveIntensity: 0.4 }),
    );
    drone.visible = false;
    scene.add(drone);

    const markerGeometry = new THREE.SphereGeometry(MARKER_RADIUS_M, 22, 16);
    const markers: Marker[] = [];
    const meshes: THREE.Mesh[] = [];

    const ensureMarkers = (count: number) => {
      while (markers.length < count) {
        const index = markers.length;
        const material = new THREE.MeshStandardMaterial({
          color: COLORS.waypoint,
          emissive: COLORS.waypoint,
          emissiveIntensity: 0.2,
        });
        const mesh = new THREE.Mesh(markerGeometry, material);
        // markers are addressed by index so a re-render mid-drag keeps hold
        // of the same object
        mesh.userData.index = index;
        mesh.add(buildLabel(index + 1));
        scene.add(mesh);
        markers.push({ mesh, material });
        meshes.push(mesh);
      }
      while (markers.length > count) {
        const marker = markers.pop();
        meshes.pop();
        if (!marker) break;
        scene.remove(marker.mesh);
        for (const child of marker.mesh.children) {
          if (child instanceof THREE.Sprite) {
            child.material.map?.dispose();
            child.material.dispose();
          }
        }
        marker.material.dispose();
      }
    };

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

    const syncScene = () => {
      const state = latest.current;
      ensureMarkers(state.waypoints.length);

      state.waypoints.forEach((wp, i) => {
        const [x, y, z] = nedToScene(wp.x, wp.y, wp.z);
        const marker = markers[i];
        marker.mesh.position.set(x, y, z);
        const active = i === state.activeIndex;
        marker.material.color.setHex(active ? COLORS.active : COLORS.waypoint);
        marker.material.emissive.setHex(active ? COLORS.active : COLORS.waypoint);
        marker.material.emissiveIntensity = active ? 0.8 : 0.2;
      });

      const active = state.activeIndex;
      halo.visible = active !== null && active >= 0 && active < markers.length;
      if (halo.visible && active !== null) halo.position.copy(markers[active].mesh.position);

      // origin -> climb point -> waypoints -> (climb point)
      const climb = nedToScene(0, 0, state.takeoffZ);
      const points = 2 + state.waypoints.length + (state.returnToOrigin ? 1 : 0);
      path.begin(points);
      path.push(0, 0, 0);
      path.push(climb[0], climb[1], climb[2]);
      for (const wp of state.waypoints) {
        const [x, y, z] = nedToScene(wp.x, wp.y, wp.z);
        path.push(x, y, z);
      }
      if (state.returnToOrigin) path.push(climb[0], climb[1], climb[2]);
      path.end();

      // altitude stalks: the only cue for how high a marker floats
      stalks.begin(state.waypoints.length * 2);
      for (const marker of markers) {
        stalks.push(marker.mesh.position.x, 0, marker.mesh.position.z);
        stalks.push(marker.mesh.position.x, marker.mesh.position.y, marker.mesh.position.z);
      }
      stalks.end();

      drone.visible = state.drone !== null;
      if (state.drone) {
        const [x, y, z] = nedToScene(state.drone.x, state.drone.y, state.drone.z);
        drone.position.set(x, Math.max(y, DRONE_FLOOR_M), z);
      }
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane();
    const grabOffset = new THREE.Vector3();
    const hit = new THREE.Vector3();
    const planeNormal = new THREE.Vector3();
    let drag: Drag | null = null;

    const castFrom = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
    };

    const pickMarker = (event: PointerEvent): THREE.Mesh | null => {
      castFrom(event);
      const hits = raycaster.intersectObjects(meshes, false);
      return hits.length > 0 ? (hits[0].object as THREE.Mesh) : null;
    };

    // plane drag slides along the marker's current altitude; altitude drag
    // uses a vertical plane facing the camera so the pointer tracks height
    const setDragPlane = (mode: DragMode, at: THREE.Vector3) => {
      if (mode === "altitude") {
        camera.getWorldDirection(planeNormal);
        planeNormal.y = 0;
        if (planeNormal.lengthSq() < 1e-6) planeNormal.set(0, 0, 1);
        planeNormal.normalize();
      } else {
        planeNormal.copy(UP);
      }
      dragPlane.setFromNormalAndCoplanarPoint(planeNormal, at);
    };

    // written straight to the dom: a drag must not re-render this component
    const showReadout = (index: number, wp: Waypoint) => {
      const n = wp.x.toFixed(1);
      const e = wp.y.toFixed(1);
      const alt = (-wp.z).toFixed(1);
      if (readout.current) readout.current.textContent = `SP${index + 1}  n ${n}  e ${e}  alt ${alt} m`;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const mesh = pickMarker(event);
      if (!mesh) return;
      const mode: DragMode = event.shiftKey ? "altitude" : "plane";
      setDragPlane(mode, mesh.position);
      if (!raycaster.ray.intersectPlane(dragPlane, hit)) return;
      grabOffset.copy(mesh.position).sub(hit);
      drag = { index: mesh.userData.index as number, mode, pointerId: event.pointerId };
      controls.enabled = false;
      host.setPointerCapture(event.pointerId);
      host.classList.add("is-dragging");
      // capture phase: orbitcontrols never sees this gesture start
      event.stopPropagation();
      event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drag) {
        // a held button means the camera is orbiting; leave the cursor alone
        if (event.buttons === 0) host.classList.toggle("is-over", pickMarker(event) !== null);
        return;
      }
      if (event.pointerId !== drag.pointerId) return;
      const state = latest.current;
      const wp = state.waypoints[drag.index];
      const mesh = meshes[drag.index];
      if (!wp || !mesh) return;

      castFrom(event);
      const mode: DragMode = event.shiftKey ? "altitude" : "plane";
      setDragPlane(mode, mesh.position);
      if (mode !== drag.mode) {
        // re-anchor on the new plane so the marker does not jump when the
        // modifier changes mid-drag
        if (raycaster.ray.intersectPlane(dragPlane, hit)) grabOffset.copy(mesh.position).sub(hit);
        drag.mode = mode;
      }
      if (!raycaster.ray.intersectPlane(dragPlane, hit)) return;
      hit.add(grabOffset);

      let next: Waypoint;
      if (mode === "altitude") {
        const [, , down] = sceneToNed(mesh.position.x, hit.y, mesh.position.z);
        next = { ...wp, z: clampGroundZ(roundM(down)) };
      } else {
        const [north, east] = sceneToNed(hit.x, mesh.position.y, hit.z);
        next = { ...wp, x: roundM(north), y: roundM(east) };
      }
      // move now, then let the parent's new props confirm it next frame
      const [x, y, z] = nedToScene(next.x, next.y, next.z);
      mesh.position.set(x, y, z);
      showReadout(drag.index, next);
      state.onChange(drag.index, next);
    };

    const endDrag = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag = null;
      controls.enabled = true;
      host.classList.remove("is-dragging");
      if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
      if (readout.current) readout.current.textContent = HINT;
    };

    const onPointerLeave = () => {
      if (!drag) host.classList.remove("is-over");
    };

    host.addEventListener("pointerdown", onPointerDown, true);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", endDrag);
    host.addEventListener("pointercancel", endDrag);
    host.addEventListener("pointerleave", onPointerLeave);

    let frame = 0;
    const tick = () => {
      syncScene();
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener("pointerdown", onPointerDown, true);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerup", endDrag);
      host.removeEventListener("pointercancel", endDrag);
      host.removeEventListener("pointerleave", onPointerLeave);
      controls.dispose();
      resetView.current = null;
      renderer.dispose();
      scene.traverse((object) => {
        const disposable = object as Partial<THREE.Mesh>;
        disposable.geometry?.dispose();
        const material = disposable.material;
        if (!material) return;
        for (const m of Array.isArray(material) ? material : [material]) {
          (m as THREE.MeshBasicMaterial).map?.dispose();
          m.dispose();
        }
      });
      host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="mission-scene">
      <div ref={mount} className="mission-scene-canvas" />
      <span ref={readout} className="mission-scene-readout">
        {HINT}
      </span>
      <button
        type="button"
        className="mission-scene-reset"
        onClick={() => resetView.current?.()}
        title="Reset view"
      >
        ⌂ view
      </button>
    </div>
  );
}
