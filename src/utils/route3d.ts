import { FLOOR2_Y, UNITS_TO_METERS, rooms3d, walkEdges, walkNodes } from "../data/venue3d";
import type { WalkNode } from "../data/venue3d";

const nodeById = new Map(walkNodes.map((node) => [node.id, node]));
const roomToNode = new Map<string, WalkNode>();
walkNodes.forEach((node) => node.rooms?.forEach((room) => roomToNode.set(room, node)));

const adjacency = new Map<string, string[]>();
walkEdges.forEach(([a, b]) => {
  adjacency.set(a, [...(adjacency.get(a) ?? []), b]);
  adjacency.set(b, [...(adjacency.get(b) ?? []), a]);
});

const FLOOR_CHANGE_COST = 90; // plan units ~ escalator ride + waiting

const dist = (a: WalkNode, b: WalkNode) => {
  const flat = Math.hypot(a.x - b.x, a.z - b.z);
  return a.floor !== b.floor ? flat + FLOOR_CHANGE_COST : flat;
};

export const roomCenter3d = (roomId: string) => {
  const room = rooms3d.find((candidate) => candidate.id === roomId);
  if (!room) return null;
  const xs = room.polygon.map(([x]) => x);
  const zs = room.polygon.map(([, z]) => z);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    z: (Math.min(...zs) + Math.max(...zs)) / 2,
    y: room.floor === "level2" ? FLOOR2_Y : 0,
    floor: room.floor,
  };
};

export type RoutePoint = { x: number; z: number; y: number };

/** A* over the corridor graph; returns 3D waypoints from roomA door to roomB door. */
export function findRoute(fromRoom: string, toRoom: string): { points: RoutePoint[]; meters: number; minutes: number } | null {
  const start = roomToNode.get(fromRoom);
  const goal = roomToNode.get(toRoom);
  const fromCenter = roomCenter3d(fromRoom);
  const toCenter = roomCenter3d(toRoom);
  if (!start || !goal || !fromCenter || !toCenter) return null;

  const open = new Set<string>([start.id]);
  const cameFrom = new Map<string, string>();
  const g = new Map<string, number>([[start.id, 0]]);
  const f = new Map<string, number>([[start.id, dist(start, goal)]]);

  while (open.size) {
    let currentId = "";
    let best = Infinity;
    open.forEach((id) => {
      const score = f.get(id) ?? Infinity;
      if (score < best) {
        best = score;
        currentId = id;
      }
    });
    if (currentId === goal.id) break;
    open.delete(currentId);
    const current = nodeById.get(currentId)!;
    (adjacency.get(currentId) ?? []).forEach((neighborId) => {
      const neighbor = nodeById.get(neighborId)!;
      const tentative = (g.get(currentId) ?? Infinity) + dist(current, neighbor);
      if (tentative < (g.get(neighborId) ?? Infinity)) {
        cameFrom.set(neighborId, currentId);
        g.set(neighborId, tentative);
        f.set(neighborId, tentative + dist(neighbor, goal));
        open.add(neighborId);
      }
    });
  }

  if (!cameFrom.has(goal.id) && start.id !== goal.id) return null;
  const ids: string[] = [goal.id];
  while (ids[0] !== start.id) ids.unshift(cameFrom.get(ids[0])!);

  const yFor = (floor: string) => (floor === "level2" ? FLOOR2_Y : 0);
  const points: RoutePoint[] = [
    { x: fromCenter.x, z: fromCenter.z, y: fromCenter.y },
    ...ids.map((id) => {
      const node = nodeById.get(id)!;
      return { x: node.x, z: node.z, y: yFor(node.floor) };
    }),
    { x: toCenter.x, z: toCenter.z, y: toCenter.y },
  ];
  // drop consecutive duplicates
  const cleaned = points.filter((p, i) => i === 0 || Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z) > 2 || p.y !== points[i - 1].y);

  let units = 0;
  for (let i = 1; i < cleaned.length; i += 1) {
    units += Math.hypot(cleaned[i].x - cleaned[i - 1].x, cleaned[i].z - cleaned[i - 1].z);
    if (cleaned[i].y !== cleaned[i - 1].y) units += FLOOR_CHANGE_COST;
  }
  const meters = units * UNITS_TO_METERS;
  const minutes = Math.max(1, Math.round(meters / 78)); // ~1.3 m/s
  return { points: cleaned, meters, minutes };
}

/** Full-day route through an ordered list of rooms. */
export function findDayRoute(roomsInOrder: string[]) {
  const legs: Array<{ from: string; to: string; points: RoutePoint[]; minutes: number }> = [];
  for (let i = 1; i < roomsInOrder.length; i += 1) {
    const leg = findRoute(roomsInOrder[i - 1], roomsInOrder[i]);
    if (leg) legs.push({ from: roomsInOrder[i - 1], to: roomsInOrder[i], points: leg.points, minutes: leg.minutes });
  }
  return legs;
}
