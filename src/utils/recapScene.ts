import * as THREE from "three";
import { FLOOR2_Y, ROOM_HEIGHT, rooms3d } from "../data/venue3d";
import type { RoutePoint } from "./route3d";

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

function makeLabelSprite(text: string): THREE.Sprite {
  const probe = document.createElement("canvas").getContext("2d")!;
  const font = '800 30px "Arial Rounded MT Bold", Arial, sans-serif';
  probe.font = font;
  const w = Math.ceil(probe.measureText(text).width) + 26;
  const h = 48;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  ctx.fillStyle = "rgba(255,248,235,0.94)";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(30,37,40,0.35)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#1e2528";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2 + 1);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }));
  sprite.scale.set(w * 0.2, h * 0.2, 1);
  sprite.renderOrder = 20;
  return sprite;
}

const centerOf = (roomId: string) => {
  const room = rooms3d.find((candidate) => candidate.id === roomId);
  if (!room) return null;
  const xs = room.polygon.map(([x]) => x);
  const zs = room.polygon.map(([, z]) => z);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    z: (Math.min(...zs) + Math.max(...zs)) / 2,
    top: (room.floor === "level2" ? FLOOR2_Y : 0) + (room.height ?? ROOM_HEIGHT),
  };
};

/**
 * Offscreen renderer of the venue for the recap GIF — deliberately identical
 * in look to the live map: same colors, soft lighting, edges, particles, labels.
 */
export function createRecapRenderer(width: number, height: number, avatarCanvases: HTMLCanvasElement[]) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfdf3e0);
  scene.fog = new THREE.Fog(0xfdf3e0, 700, 1700);

  const camera = new THREE.PerspectiveCamera(42, width / height, 1, 4000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.AmbientLight(0xfff2dc, 0.75));
  const key = new THREE.DirectionalLight(0xffe8c2, 1.15);
  key.position.set(200, 500, 150);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const span = 620;
  key.shadow.camera.left = -span;
  key.shadow.camera.right = span;
  key.shadow.camera.top = span;
  key.shadow.camera.bottom = -span;
  key.shadow.camera.far = 1600;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcfe4ff, 0.4);
  fill.position.set(900, 260, 700);
  scene.add(fill);

  const meshByRoom = new Map<string, THREE.Mesh>();
  rooms3d.forEach((room) => {
    const shape = new THREE.Shape(room.polygon.map(([x, z]) => new THREE.Vector2(x, z)));
    const depth = room.kind === "landmark" ? 1.5 : room.height ?? ROOM_HEIGHT;
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 1.4, bevelSize: 1.4, bevelSegments: 3 });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, depth, 0);
    const baseColor = new THREE.Color(ZONE_COLORS[room.zone] ?? 0xeeddc0);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.6,
        metalness: 0.02,
        transparent: true,
        opacity: room.kind === "landmark" ? 0.5 : room.kind === "lobby" ? 0.85 : 0.96,
        emissive: baseColor.clone().multiplyScalar(0.12),
      }),
    );
    mesh.castShadow = room.kind !== "landmark";
    mesh.receiveShadow = true;
    mesh.position.y = room.floor === "level2" ? FLOOR2_Y : 0;
    scene.add(mesh);
    meshByRoom.set(room.id, mesh);
    if (room.kind !== "landmark") {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo, 24),
        new THREE.LineBasicMaterial({ color: 0x1e2528, transparent: true, opacity: 0.16 }),
      );
      edges.position.copy(mesh.position);
      scene.add(edges);
    }
  });

  // ground slab
  const pts = rooms3d.flatMap((room) => room.polygon);
  const xs = pts.map(([x]) => x);
  const zs = pts.map(([, z]) => z);
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(...xs) - Math.min(...xs) + 70, 5, Math.max(...zs) - Math.min(...zs) + 70),
    new THREE.MeshStandardMaterial({ color: 0xf7e4c3, roughness: 0.95 }),
  );
  slab.position.set((Math.min(...xs) + Math.max(...xs)) / 2, -2.5, (Math.min(...zs) + Math.max(...zs)) / 2);
  slab.receiveShadow = true;
  scene.add(slab);

  // ambient splat particles, same recipe as the live map
  const splatCount = 200;
  const positions = new Float32Array(splatCount * 3);
  const colors = new Float32Array(splatCount * 3);
  const palette = [0xf2a678, 0xb8d9a0, 0xa9cbe8, 0xd9c6ea, 0xf6d78a].map((c) => new THREE.Color(c));
  for (let i = 0; i < splatCount; i += 1) {
    positions[i * 3] = Math.min(...xs) + Math.random() * (Math.max(...xs) - Math.min(...xs));
    positions[i * 3 + 1] = 4 + Math.random() * 90;
    positions[i * 3 + 2] = Math.min(...zs) + Math.random() * (Math.max(...zs) - Math.min(...zs));
    const color = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  const splatGeo = new THREE.BufferGeometry();
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
  scene.add(
    new THREE.Points(
      splatGeo,
      new THREE.PointsMaterial({
        size: 10,
        map: new THREE.CanvasTexture(splatCanvas),
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    ),
  );

  const routeGroup = new THREE.Group();
  const labelGroup = new THREE.Group();
  scene.add(routeGroup, labelGroup);

  const avatarMaterials = avatarCanvases.map(
    (canvas) => new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }),
  );
  const avatarSprite = new THREE.Sprite(avatarMaterials[0]);
  avatarSprite.scale.set(30, 42, 1);
  avatarSprite.renderOrder = 30;
  avatarSprite.visible = false;
  scene.add(avatarSprite);

  const highlighted = new Set<string>();

  return {
    canvas: renderer.domElement,
    roomCenter: centerOf,
    setDay(stopRooms: string[], routePoints: RoutePoint[]) {
      routeGroup.clear();
      labelGroup.clear();
      if (routePoints.length >= 2) {
        const curve = new THREE.CatmullRomCurve3(
          routePoints.map((p) => new THREE.Vector3(p.x, p.y + 4, p.z)),
          false,
          "catmullrom",
          0.1,
        );
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, Math.min(300, routePoints.length * 12), 2, 8, false),
          new THREE.MeshStandardMaterial({ color: 0x2b7291, emissive: 0x2b7291, emissiveIntensity: 0.4, roughness: 0.4 }),
        );
        tube.renderOrder = 10;
        routeGroup.add(tube);
      }
      highlighted.forEach((id) => {
        const mesh = meshByRoom.get(id);
        if (!mesh) return;
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.emissive = material.color.clone().multiplyScalar(0.12);
      });
      highlighted.clear();
      stopRooms.forEach((id, index) => {
        const mesh = meshByRoom.get(id);
        if (!mesh) return;
        (mesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0xff8f66).multiplyScalar(0.5);
        highlighted.add(id);
        const c = centerOf(id);
        if (c) {
          const label = makeLabelSprite(`${index + 1}`);
          label.position.set(c.x, c.top + 16, c.z);
          labelGroup.add(label);
        }
      });
    },
    setAvatar(point: { x: number; y: number; z: number } | null, bobPhase = 0, poseIndex = 0) {
      if (!point) {
        avatarSprite.visible = false;
        return;
      }
      avatarSprite.visible = true;
      avatarSprite.material = avatarMaterials[poseIndex % avatarMaterials.length];
      avatarSprite.position.set(point.x, point.y + 24 + Math.sin(bobPhase) * 2, point.z);
    },
    render(focus: { x: number; z: number }, angle: number, radius: number, camHeight: number, lookY = 6) {
      camera.position.set(focus.x + Math.sin(angle) * radius, camHeight, focus.z + Math.cos(angle) * radius);
      camera.lookAt(focus.x, lookY, focus.z);
      renderer.render(scene, camera);
    },
    dispose() {
      renderer.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
    },
  };
}
