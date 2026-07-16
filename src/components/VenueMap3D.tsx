import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FLOOR2_Y, ROOM_HEIGHT, gpsAnchor, planBounds, rooms3d } from "../data/venue3d";
import type { Room3D } from "../data/venue3d";
import { findDayRoute } from "../utils/route3d";
import type { ScheduleItem } from "../types";

type FloorMode = "both" | "level1" | "level2";

export type MapLayers = {
  restrooms: boolean;
  food: boolean;
  vertical: boolean;
  route: boolean;
};

const AMENITY_ICON: Record<string, { glyph: string; layer: keyof MapLayers }> = {
  restroom: { glyph: "🚻", layer: "restrooms" },
  food: { glyph: "☕", layer: "food" },
  stairs: { glyph: "🪜", layer: "vertical" },
  elevator: { glyph: "🛗", layer: "vertical" },
  escalator: { glyph: "↗", layer: "vertical" },
  info: { glyph: "ℹ", layer: "vertical" },
};

function makeIconSprite(glyph: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 72;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(255,248,235,0.95)";
  ctx.beginPath();
  ctx.arc(36, 36, 33, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(30,37,40,0.4)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.font = "38px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#2b4a5e";
  ctx.fillText(glyph, 36, 39);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }),
  );
  sprite.scale.set(15, 15, 1);
  sprite.renderOrder = 22;
  return sprite;
}

const ZONE_COLORS: Record<string, number> = {
  "300 rooms": 0xf6d78a,
  "400 rooms": 0xf2a678,
  "500 rooms": 0xb8d9a0,
  "South halls": 0xa9cbe8,
  "West halls": 0xa9cbe8,
  "Petree zone": 0x9fc4e0,
  Concourse: 0xe8c9a0,
  "West lobby": 0xd9c6ea,
};

const KIND_OPACITY: Record<Room3D["kind"], number> = {
  meeting: 1,
  hall: 0.92,
  lobby: 0.85,
  theater: 1,
  food: 0.95,
  landmark: 0.5,
};

const centerOf = (room: Room3D) => {
  const xs = room.polygon.map(([x]) => x);
  const zs = room.polygon.map(([, z]) => z);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
};

function makeLabelSprite(text: string, small = false): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = `800 ${small ? 26 : 34}px "Arial Rounded MT Bold", Arial, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 28;
  const h = small ? 44 : 56;
  canvas.width = w;
  canvas.height = h;
  const c2 = canvas.getContext("2d")!;
  c2.font = font;
  c2.fillStyle = "rgba(255,248,235,0.92)";
  c2.beginPath();
  c2.roundRect(0, 0, w, h, h / 2);
  c2.fill();
  c2.strokeStyle = "rgba(30,37,40,0.35)";
  c2.lineWidth = 3;
  c2.stroke();
  c2.fillStyle = "#1e2528";
  c2.textAlign = "center";
  c2.textBaseline = "middle";
  c2.fillText(text, w / 2, h / 2 + 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  const scale = small ? 0.2 : 0.26;
  sprite.scale.set(w * scale, h * scale, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function gpsToPlan(lat: number, lon: number) {
  const dLatM = (lat - gpsAnchor.lat) * gpsAnchor.metersPerDegLat;
  const dLonM = (lon - gpsAnchor.lon) * gpsAnchor.metersPerDegLon;
  const rad = (gpsAnchor.rotationDeg * Math.PI) / 180;
  // rotate ENU into plan axes; plan +z is "south" on the sheet
  const xM = dLonM * Math.cos(rad) - dLatM * Math.sin(rad);
  const zM = -(dLonM * Math.sin(rad) + dLatM * Math.cos(rad));
  return { x: gpsAnchor.x + xM / 0.55, z: gpsAnchor.z + zM / 0.55 };
}

export function VenueMap3D({
  sessionsByRoom,
  highlightedRoom,
  usedRooms,
  routeRooms,
  showRoute,
  layers,
  onRoomSelect,
}: {
  /** Active sessions right now keyed by room id (for glow + tooltip). */
  sessionsByRoom: Map<string, ScheduleItem[]>;
  highlightedRoom: string | null;
  usedRooms: Set<string>;
  /** Ordered room ids of the selected plan (route legs are computed inside). */
  routeRooms: string[];
  showRoute: boolean;
  layers: MapLayers;
  onRoomSelect: (roomId: string) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [floorMode, setFloorMode] = useState<FloorMode>("both");
  const [tooltip, setTooltip] = useState<{ x: number; y: number; title: string; lines: string[] } | null>(null);
  const [gpsState, setGpsState] = useState<"off" | "locating" | "on" | "outside" | "error">("off");
  const routeLegs = useMemo(() => (showRoute && routeRooms.length > 1 ? findDayRoute(routeRooms) : []), [routeRooms, showRoute]);
  const walkMinutes = routeLegs.reduce((sum, leg) => sum + leg.minutes, 0);

  const stateRef = useRef<{
    meshes: Map<string, THREE.Mesh>;
    setFloorMode?: (mode: FloorMode) => void;
    setRoute?: (legs: ReturnType<typeof findDayRoute>) => void;
    setHighlight?: (roomId: string | null) => void;
    setActive?: (rooms: Set<string>) => void;
    setGps?: (pos: { x: number; z: number } | null) => void;
    setLayers?: (layers: MapLayers) => void;
    dispose?: () => void;
  }>({ meshes: new Map() });

  // ---- Scene bootstrap (once) ----
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfdf3e0);
    scene.fog = new THREE.Fog(0xfdf3e0, 700, 1700);

    const width = mount.clientWidth;
    const height = mount.clientHeight || 460;
    const camera = new THREE.PerspectiveCamera(42, width / height, 1, 4000);
    const cx = (planBounds.minX + planBounds.maxX) / 2;
    const cz = (planBounds.minZ + planBounds.maxZ) / 2;
    camera.position.set(cx + 40, 430, cz + 430);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(cx, 10, cz);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minDistance = 120;
    controls.maxDistance = 1200;

    // Lights — warm key + cool fill + soft ambient for the pastel splat look
    scene.add(new THREE.AmbientLight(0xfff2dc, 0.75));
    const key = new THREE.DirectionalLight(0xffe8c2, 1.15);
    key.position.set(cx - 300, 500, cz - 200);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const span = 620;
    key.shadow.camera.left = -span;
    key.shadow.camera.right = span;
    key.shadow.camera.top = span;
    key.shadow.camera.bottom = -span;
    key.shadow.camera.far = 1600;
    key.shadow.radius = 6;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xcfe4ff, 0.4);
    fill.position.set(cx + 400, 260, cz + 320);
    scene.add(fill);

    // Ground slabs hug each floor's real extent
    const boundsFor = (floor: "level1" | "level2") => {
      const pts = rooms3d.filter((room) => room.floor === floor).flatMap((room) => room.polygon);
      const xs = pts.map(([x]) => x);
      const zs = pts.map(([, z]) => z);
      const pad = 26;
      return {
        minX: Math.min(...xs) - pad,
        maxX: Math.max(...xs) + pad,
        minZ: Math.min(...zs) - pad,
        maxZ: Math.max(...zs) + pad,
      };
    };
    const makeSlab = (floor: "level1" | "level2", y: number, opacity: number) => {
      const bounds = boundsFor(floor);
      const shape = new THREE.Shape();
      const r = 22;
      shape.moveTo(bounds.minX + r, bounds.minZ);
      shape.lineTo(bounds.maxX - r, bounds.minZ);
      shape.quadraticCurveTo(bounds.maxX, bounds.minZ, bounds.maxX, bounds.minZ + r);
      shape.lineTo(bounds.maxX, bounds.maxZ - r);
      shape.quadraticCurveTo(bounds.maxX, bounds.maxZ, bounds.maxX - r, bounds.maxZ);
      shape.lineTo(bounds.minX + r, bounds.maxZ);
      shape.quadraticCurveTo(bounds.minX, bounds.maxZ, bounds.minX, bounds.maxZ - r);
      shape.lineTo(bounds.minX, bounds.minZ + r);
      shape.quadraticCurveTo(bounds.minX, bounds.minZ, bounds.minX + r, bounds.minZ);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 5, bevelEnabled: false });
      geo.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: 0xf7e4c3, roughness: 0.95, transparent: opacity < 1, opacity }),
      );
      mesh.position.y = y + 5;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };
    makeSlab("level1", -5, 1);
    const slab2 = makeSlab("level2", FLOOR2_Y - 5, 0.6);

    // Floating ambient "splat" particles for the 3DGS vibe
    const splatCount = 260;
    const splatGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(splatCount * 3);
    const colors = new Float32Array(splatCount * 3);
    const palette = [0xf2a678, 0xb8d9a0, 0xa9cbe8, 0xd9c6ea, 0xf6d78a].map((c) => new THREE.Color(c));
    for (let i = 0; i < splatCount; i += 1) {
      positions[i * 3] = planBounds.minX + Math.random() * (planBounds.maxX - planBounds.minX);
      positions[i * 3 + 1] = 4 + Math.random() * 90;
      positions[i * 3 + 2] = planBounds.minZ + Math.random() * (planBounds.maxZ - planBounds.minZ);
      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    splatGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    splatGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const splatCanvas = document.createElement("canvas");
    splatCanvas.width = splatCanvas.height = 64;
    const sctx = splatCanvas.getContext("2d")!;
    const grad = sctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, "rgba(255,255,255,0.85)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 64, 64);
    const splats = new THREE.Points(
      splatGeo,
      new THREE.PointsMaterial({
        size: 10,
        map: new THREE.CanvasTexture(splatCanvas),
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    scene.add(splats);

    // Rooms
    const meshes = new Map<string, THREE.Mesh>();
    const level1Group = new THREE.Group();
    const level2Group = new THREE.Group();
    scene.add(level1Group, level2Group);
    const amenitySprites: Array<{ sprite: THREE.Sprite; floor: "level1" | "level2"; layer: keyof MapLayers }> = [];
    let currentMode: FloorMode = "both";
    let currentLayers: MapLayers = { restrooms: true, food: true, vertical: false, route: true };
    const applyAmenityVisibility = () => {
      amenitySprites.forEach(({ sprite, floor, layer }) => {
        const floorVisible = currentMode === "both" || currentMode === floor;
        sprite.visible = floorVisible && currentLayers[layer];
      });
    };

    rooms3d.forEach((room) => {
      const shape = new THREE.Shape(room.polygon.map(([x, z]) => new THREE.Vector2(x, z)));
      const depth = room.kind === "landmark" ? 1.5 : room.height ?? ROOM_HEIGHT;
      const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 1.4, bevelSize: 1.4, bevelSegments: 3 });
      geo.rotateX(Math.PI / 2);
      geo.translate(0, depth, 0);
      const baseColor = new THREE.Color(ZONE_COLORS[room.zone] ?? 0xeeddc0);
      const material = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.6,
        metalness: 0.02,
        transparent: true,
        opacity: KIND_OPACITY[room.kind],
        emissive: baseColor.clone().multiplyScalar(0.12),
      });
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = room.kind !== "landmark";
      mesh.receiveShadow = true;
      mesh.position.y = room.floor === "level2" ? FLOOR2_Y : 0;
      mesh.userData = { roomId: room.id, baseColor, room };
      (room.floor === "level2" ? level2Group : level1Group).add(mesh);
      meshes.set(room.id, mesh);

      if (room.kind !== "landmark") {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo, 24),
          new THREE.LineBasicMaterial({ color: 0x1e2528, transparent: true, opacity: 0.16 }),
        );
        edges.position.copy(mesh.position);
        (room.floor === "level2" ? level2Group : level1Group).add(edges);
      }

      if (room.kind !== "landmark" && usedRooms.has(room.id)) {
        const { x, z } = centerOf(room);
        const label = makeLabelSprite(room.label, room.polygon.length > 4 || room.kind === "meeting");
        label.position.set(x, mesh.position.y + depth + 8, z);
        (room.floor === "level2" ? level2Group : level1Group).add(label);
      }

      // Amenity icons (toggled by the layer bar), placed at the room they belong to.
      if (room.amenities?.length) {
        const { x, z } = centerOf(room);
        room.amenities.forEach((amenity, index) => {
          const icon = AMENITY_ICON[amenity];
          if (!icon) return;
          const sprite = makeIconSprite(icon.glyph);
          sprite.position.set(x - 12 + index * 13, mesh.position.y + depth + 20, z + 10);
          scene.add(sprite);
          amenitySprites.push({ sprite, floor: room.floor, layer: icon.layer });
        });
      }
    });

    // Route group (static trace — the walking recap lives in the GIF/route preview)
    const routeGroup = new THREE.Group();
    scene.add(routeGroup);

    // GPS dot
    const gpsDot = new THREE.Mesh(
      new THREE.SphereGeometry(5, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0x2b7291 }),
    );
    const gpsPulse = new THREE.Mesh(
      new THREE.RingGeometry(6, 9, 32),
      new THREE.MeshBasicMaterial({ color: 0x2b7291, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    gpsPulse.rotation.x = -Math.PI / 2;
    gpsDot.visible = gpsPulse.visible = false;
    scene.add(gpsDot, gpsPulse);

    // Raycasting
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered: THREE.Mesh | null = null;

    const pick = (event: PointerEvent): THREE.Mesh | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const groups = [level1Group, level2Group].filter((group) => group.visible);
      const hits = raycaster.intersectObjects(groups, true);
      const hit = hits.find((candidate) => (candidate.object as THREE.Mesh).userData?.roomId);
      return (hit?.object as THREE.Mesh) ?? null;
    };

    let currentActive = new Set<string>();
    let currentHighlight: string | null = null;

    const refreshEmissives = () => {
      const time = performance.now() / 1000;
      meshes.forEach((mesh) => {
        const material = mesh.material as THREE.MeshStandardMaterial;
        const base: THREE.Color = mesh.userData.baseColor;
        const isActive = currentActive.has(mesh.userData.roomId);
        const isHighlight = currentHighlight === mesh.userData.roomId;
        const isHover = hovered === mesh;
        let intensity = 0.12;
        if (isActive) intensity = 0.4 + Math.sin(time * 2.4) * 0.12;
        if (isHover) intensity = Math.max(intensity, 0.5);
        if (isHighlight) intensity = 0.75 + Math.sin(time * 3.4) * 0.2;
        material.emissive = (isHighlight ? new THREE.Color(0xff8f66) : base).clone().multiplyScalar(intensity);
      });
    };

    const onPointerMove = (event: PointerEvent) => {
      const mesh = pick(event);
      hovered = mesh;
      renderer.domElement.style.cursor = mesh ? "pointer" : "grab";
      if (mesh) {
        const roomId: string = mesh.userData.roomId;
        const active = sessionsRef.current.get(roomId) ?? [];
        const rect = renderer.domElement.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          title: mesh.userData.room.label,
          lines: active.slice(0, 3).map((item) => `${item.start} ${item.title.slice(0, 46)}`),
        });
      } else {
        setTooltip(null);
      }
    };
    const onClick = (event: PointerEvent) => {
      const mesh = pick(event);
      if (mesh) onRoomSelect(mesh.userData.roomId);
    };
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onClick);

    // Route drawing (static glowing trace + numbered stops)
    const setRoute = (legs: ReturnType<typeof findDayRoute>) => {
      routeGroup.clear();
      const allPoints = legs.flatMap((leg) => leg.points);
      if (allPoints.length < 2) return;
      const vecs = allPoints.map((p) => new THREE.Vector3(p.x, p.y + 4, p.z));
      const curve = new THREE.CatmullRomCurve3(vecs, false, "catmullrom", 0.12);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.min(400, vecs.length * 14), 1.7, 8, false),
        new THREE.MeshStandardMaterial({ color: 0x2b7291, emissive: 0x2b7291, emissiveIntensity: 0.35, roughness: 0.4 }),
      );
      tube.renderOrder = 10;
      routeGroup.add(tube);
      const stopRooms = [legs[0]?.from, ...legs.map((leg) => leg.to)].filter(Boolean) as string[];
      stopRooms.forEach((roomId, index) => {
        const mesh = meshes.get(roomId);
        if (!mesh) return;
        const { x, z } = centerOf(mesh.userData.room);
        const bubble = makeLabelSprite(String(index + 1), true);
        bubble.position.set(x, mesh.position.y + (mesh.userData.room.height ?? ROOM_HEIGHT) + 20, z);
        routeGroup.add(bubble);
      });
    };

    // reactive state setters used by the outer effects
    const sessionsRef = { current: new Map<string, ScheduleItem[]>() };
    stateRef.current = {
      meshes,
      setFloorMode: (mode) => {
        currentMode = mode;
        level1Group.visible = mode !== "level2";
        level2Group.visible = mode !== "level1";
        slab2.visible = mode !== "level1";
        (slab2.material as THREE.MeshStandardMaterial).opacity = mode === "level2" ? 0.9 : 0.6;
        applyAmenityVisibility();
      },
      setLayers: (nextLayers) => {
        currentLayers = nextLayers;
        applyAmenityVisibility();
      },
      setRoute,
      setHighlight: (roomId) => {
        currentHighlight = roomId;
      },
      setActive: (roomsSet) => {
        currentActive = roomsSet;
      },
      setGps: (pos) => {
        if (!pos) {
          gpsDot.visible = gpsPulse.visible = false;
          return;
        }
        gpsDot.visible = gpsPulse.visible = true;
        gpsDot.position.set(pos.x, 6, pos.z);
        gpsPulse.position.set(pos.x, 2.5, pos.z);
      },
      dispose: () => undefined,
    };
    (stateRef.current as unknown as { sessionsRef: typeof sessionsRef }).sessionsRef = sessionsRef;

    let frame = 0;
    let disposed = false;
    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      controls.update();
      refreshEmissives();
      splats.rotation.y += 0.00035;
      const time = performance.now() / 1000;
      gpsPulse.scale.setScalar(1 + Math.sin(time * 3) * 0.25);
      (gpsPulse.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(time * 3) * 0.2;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight || 460;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onClick);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Reactive updates ----
  useEffect(() => {
    stateRef.current.setFloorMode?.(floorMode);
  }, [floorMode]);
  useEffect(() => {
    stateRef.current.setHighlight?.(highlightedRoom);
  }, [highlightedRoom]);
  useEffect(() => {
    const ref = (stateRef.current as unknown as { sessionsRef?: { current: Map<string, ScheduleItem[]> } }).sessionsRef;
    if (ref) ref.current = sessionsByRoom;
    stateRef.current.setActive?.(new Set(sessionsByRoom.keys()));
  }, [sessionsByRoom]);
  useEffect(() => {
    stateRef.current.setRoute?.(routeLegs);
  }, [routeLegs]);
  useEffect(() => {
    stateRef.current.setLayers?.(layers);
  }, [layers]);

  // GPS
  useEffect(() => {
    if (gpsState !== "locating" && gpsState !== "on" && gpsState !== "outside") return undefined;
    if (!("geolocation" in navigator)) {
      setGpsState("error");
      return undefined;
    }
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        const plan = gpsToPlan(position.coords.latitude, position.coords.longitude);
        const inside =
          plan.x > planBounds.minX - 80 && plan.x < planBounds.maxX + 80 && plan.z > planBounds.minZ - 80 && plan.z < planBounds.maxZ + 80;
        stateRef.current.setGps?.(inside ? plan : null);
        setGpsState(inside ? "on" : "outside");
      },
      () => setGpsState("error"),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [gpsState]);

  return (
    <section className="mapCard map3dCard" aria-label="LACC 3D venue map">
      <header>
        <div>
          <p className="eyebrow">Traced from the official LACC floor plans</p>
          <h2>LACC in 3D</h2>
        </div>
        <div className="map3dControls">
          <div className="segmented" role="tablist" aria-label="Floor">
            {(["both", "level1", "level2"] as FloorMode[]).map((mode) => (
              <button key={mode} className={floorMode === mode ? "activeSegment" : ""} onClick={() => setFloorMode(mode)}>
                {mode === "both" ? "Both" : mode === "level1" ? "Level 1" : "Level 2"}
              </button>
            ))}
          </div>
          <button
            className={`gpsButton ${gpsState === "on" ? "gpsOn" : ""}`}
            onClick={() => setGpsState((state) => (state === "off" || state === "error" ? "locating" : "off"))}
            title="Show my position (GPS is approximate indoors)"
          >
            {gpsState === "off" && "Find me"}
            {gpsState === "locating" && "Locating..."}
            {gpsState === "on" && "GPS on"}
            {gpsState === "outside" && "Outside venue"}
            {gpsState === "error" && "GPS unavailable"}
          </button>
        </div>
      </header>
      <div className="map3dViewport" ref={mountRef}>
        {tooltip && (
          <div className="map3dTooltip" style={{ left: tooltip.x + 14, top: tooltip.y + 10 }}>
            <strong>{tooltip.title}</strong>
            {tooltip.lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
            {!tooltip.lines.length && <span className="mutedText">No live session at selected time</span>}
          </div>
        )}
      </div>
      <p className="map3dHint">
        Drag to orbit, scroll to zoom, click a room to jump to its sessions.
        {showRoute && routeRooms.length > 1 && ` Route: ${routeRooms.length} stops, ~${walkMinutes} min total walking.`}
      </p>
    </section>
  );
}
