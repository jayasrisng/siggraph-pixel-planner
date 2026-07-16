// Accurate LACC geometry traced from the official venue map PDFs:
// - Level One | Exhibit Halls: LevelOne-ExhibitHalls-41aa5293da.pdf
// - Level Two | Meeting Rooms: LevelTwo-MeetingRooms-d8a1e35187.pdf
// Master frame: plan units roughly follow the Level Two sheet (1 unit ~ 0.55 m).
// x grows east, z grows south. Level 1 sits at y=0, Level 2 at y=FLOOR2_Y.

export const FLOOR2_Y = 26;
export const ROOM_HEIGHT = 14;
export const HALL_HEIGHT = 22;

export type Vec2 = [number, number];

export type Room3D = {
  id: string;
  label: string;
  floor: "level1" | "level2";
  /** Convex footprint polygon in plan units (clockwise). */
  polygon: Vec2[];
  height?: number;
  kind: "meeting" | "hall" | "lobby" | "theater" | "food" | "landmark";
  zone: string;
  amenities?: string[];
};

const rect = (x: number, z: number, w: number, h: number, rotateDeg = 0): Vec2[] => {
  const cx = x + w / 2;
  const cz = z + h / 2;
  const rad = (rotateDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const pts: Vec2[] = [
    [x, z],
    [x + w, z],
    [x + w, z + h],
    [x, z + h],
  ];
  return pts.map(([px, pz]) => [
    cx + (px - cx) * cos - (pz - cz) * sin,
    cz + (px - cx) * sin + (pz - cz) * cos,
  ]);
};

// Angle of the South Exhibit Hall diagonal on the official sheets.
const DIAG = -40;

export const rooms3d: Room3D[] = [
  // ---------------- LEVEL 2: 300 series (hug the South Hall diagonal) ----------------
  { id: "308", label: "308", floor: "level2", kind: "meeting", zone: "300 rooms", polygon: rect(282, 373, 38, 44, DIAG) },
  { id: "307", label: "307", floor: "level2", kind: "meeting", zone: "300 rooms", polygon: rect(263, 402, 26, 32, DIAG) },
  { id: "306", label: "306", floor: "level2", kind: "meeting", zone: "300 rooms", polygon: rect(242, 421, 37, 40, DIAG) },
  { id: "305", label: "305", floor: "level2", kind: "meeting", zone: "300 rooms", polygon: rect(191, 480, 38, 24, DIAG) },
  { id: "304", label: "304", floor: "level2", kind: "meeting", zone: "300 rooms", polygon: rect(160, 496, 53, 53, DIAG) },
  { id: "303", label: "303", floor: "level2", kind: "meeting", zone: "300 rooms", polygon: rect(96, 562, 48, 35, DIAG) },
  { id: "301", label: "301/302", floor: "level2", kind: "meeting", zone: "300 rooms", polygon: rect(51, 591, 48, 53, DIAG) },
  { id: "309", label: "309", floor: "level2", kind: "meeting", zone: "300 rooms", polygon: rect(309, 418, 37, 30, DIAG) },

  // ---------------- LEVEL 2: 400 series along Meeting Room Concourse ----------------
  { id: "402", label: "401/402", floor: "level2", kind: "meeting", zone: "400 rooms", polygon: rect(357, 442, 24, 74) },
  { id: "403A", label: "403A", floor: "level2", kind: "meeting", zone: "400 rooms", polygon: rect(397, 467, 34, 59), amenities: ["stairs"] },
  { id: "403B", label: "403B", floor: "level2", kind: "meeting", zone: "400 rooms", polygon: rect(431, 467, 36, 59) },
  { id: "405", label: "405", floor: "level2", kind: "meeting", zone: "400 rooms", polygon: rect(478, 447, 29, 20) },
  { id: "407", label: "407", floor: "level2", kind: "meeting", zone: "400 rooms", polygon: rect(507, 447, 30, 20) },
  { id: "404AB", label: "404AB", floor: "level2", kind: "meeting", zone: "400 rooms", polygon: rect(478, 473, 29, 48) },
  { id: "406AB", label: "406AB", floor: "level2", kind: "meeting", zone: "400 rooms", polygon: rect(507, 473, 30, 48) },
  { id: "408A", label: "408A", floor: "level2", kind: "meeting", zone: "400 rooms", polygon: rect(550, 468, 36, 58) },
  { id: "408B", label: "408B", floor: "level2", kind: "meeting", zone: "400 rooms", polygon: rect(586, 468, 36, 58) },
  { id: "410", label: "410", floor: "level2", kind: "meeting", zone: "400 rooms", polygon: rect(633, 447, 25, 20) },
  { id: "409AB", label: "409AB", floor: "level2", kind: "meeting", zone: "400 rooms", polygon: rect(633, 473, 25, 49) },
  {
    id: "411 Theater",
    label: "411 Theatre",
    floor: "level2",
    kind: "theater",
    zone: "400 rooms",
    // Fan-shaped theatre between 409/410 and West Lobby.
    polygon: [
      [669, 470],
      [681, 440],
      [706, 432],
      [730, 442],
      [736, 470],
      [726, 498],
      [700, 508],
      [678, 496],
    ],
    amenities: ["escalator"],
  },
  { id: "West Lobby L2", label: "West Lobby", floor: "level2", kind: "lobby", zone: "West lobby", polygon: rect(748, 433, 82, 52), amenities: ["stairs", "escalator"] },
  { id: "Concourse Spine", label: "Meeting Room Concourse", floor: "level2", kind: "landmark", zone: "400 rooms", polygon: rect(395, 529, 240, 9) },

  // ---------------- LEVEL 2: 500 series tucked under/next to West Exhibit Hall ----------------
  { id: "503", label: "503", floor: "level2", kind: "meeting", zone: "500 rooms", polygon: rect(619, 301, 27, 46) },
  { id: "502B", label: "502B", floor: "level2", kind: "meeting", zone: "500 rooms", polygon: rect(655, 303, 39, 57) },
  { id: "502A", label: "502A", floor: "level2", kind: "meeting", zone: "500 rooms", polygon: rect(694, 303, 34, 57), amenities: ["restroom"] },
  { id: "501ABC", label: "501ABC", floor: "level2", kind: "meeting", zone: "500 rooms", polygon: rect(728, 301, 30, 55) },
  { id: "504-507", label: "504-507", floor: "level2", kind: "meeting", zone: "500 rooms", polygon: rect(670, 263, 81, 24) },
  { id: "508", label: "508", floor: "level2", kind: "meeting", zone: "500 rooms", polygon: rect(758, 263, 60, 24) },
  { id: "510", label: "510", floor: "level2", kind: "meeting", zone: "500 rooms", polygon: rect(856, 263, 19, 24) },
  { id: "512", label: "512", floor: "level2", kind: "meeting", zone: "500 rooms", polygon: rect(875, 263, 17, 24) },
  { id: "513", label: "513", floor: "level2", kind: "meeting", zone: "500 rooms", polygon: rect(892, 263, 17, 24) },
  { id: "514", label: "514", floor: "level2", kind: "meeting", zone: "500 rooms", polygon: rect(909, 263, 17, 24) },
  { id: "516", label: "516", floor: "level2", kind: "meeting", zone: "500 rooms", polygon: rect(930, 263, 13, 24) },
  { id: "511C", label: "511ABC", floor: "level2", kind: "meeting", zone: "500 rooms", polygon: rect(841, 301, 29, 55) },
  { id: "515A", label: "515A", floor: "level2", kind: "meeting", zone: "500 rooms", polygon: rect(873, 303, 44, 64) },
  { id: "515B", label: "515B", floor: "level2", kind: "meeting", zone: "500 rooms", polygon: rect(917, 303, 37, 64) },
  { id: "517", label: "517", floor: "level2", kind: "meeting", zone: "500 rooms", polygon: rect(958, 288, 21, 13) },
  { id: "518", label: "518", floor: "level2", kind: "meeting", zone: "500 rooms", polygon: rect(956, 303, 30, 32) },
  { id: "519", label: "519", floor: "level2", kind: "meeting", zone: "500 rooms", polygon: rect(958, 337, 19, 14) },

  // ---------------- LEVEL 1 ----------------
  {
    id: "South Exhibit Hall K",
    label: "South Hall K",
    floor: "level1",
    kind: "hall",
    zone: "South halls",
    height: HALL_HEIGHT,
    // North-east section of the huge diagonal South Exhibit Hall.
    polygon: [
      [186, 340],
      [292, 348],
      [312, 402],
      [232, 470],
      [168, 400],
    ],
    amenities: ["restroom", "elevator"],
  },
  {
    id: "South Hall K Lobby",
    label: "K Lobby",
    floor: "level1",
    kind: "lobby",
    zone: "South halls",
    polygon: rect(238, 452, 90, 26, DIAG),
    amenities: ["food", "restroom"],
  },
  { id: "West Exhibit Hall B", label: "West Hall B", floor: "level1", kind: "hall", zone: "West halls", height: HALL_HEIGHT, polygon: rect(618, 95, 154, 225) },
  { id: "West Exhibit Hall A", label: "West Hall A", floor: "level1", kind: "hall", zone: "West halls", height: HALL_HEIGHT, polygon: rect(772, 95, 218, 225), amenities: ["restroom", "elevator", "food"] },
  { id: "Galaxy Court", label: "Galaxy Court", floor: "level1", kind: "food", zone: "Concourse", polygon: rect(622, 354, 145, 72), amenities: ["food"] },
  { id: "Petree Hall", label: "Petree Hall", floor: "level1", kind: "hall", zone: "Petree zone", height: 18, polygon: rect(860, 351, 114, 76), amenities: ["restroom"] },
  { id: "Petree C", label: "Petree C", floor: "level1", kind: "hall", zone: "Petree zone", height: 18, polygon: rect(860, 351, 56, 76) },
  { id: "Petree D", label: "Petree D", floor: "level1", kind: "hall", zone: "Petree zone", height: 18, polygon: rect(916, 351, 58, 76) },
  { id: "Petree D Lobby", label: "Petree Plaza", floor: "level1", kind: "lobby", zone: "Petree zone", polygon: rect(860, 432, 114, 26) },
  { id: "Concourse Hall", label: "Concourse Hall", floor: "level1", kind: "hall", zone: "Concourse", height: 16, polygon: rect(511, 493, 132, 84), amenities: ["info", "restroom", "food"] },
  {
    id: "Concourse Foyer",
    label: "Concourse Foyer",
    floor: "level1",
    kind: "lobby",
    zone: "Concourse",
    polygon: rect(650, 508, 70, 42, DIAG + 8),
  },
  { id: "West Lobby", label: "West Lobby", floor: "level1", kind: "lobby", zone: "West lobby", polygon: rect(756, 480, 86, 48), amenities: ["stairs", "food", "restroom", "escalator"] },
];

// ---------------- Walk graph (A* over corridors, escalators join floors) ----------------
export type WalkNode = {
  id: string;
  x: number;
  z: number;
  floor: "level1" | "level2";
  /** Rooms whose doors attach to this node. */
  rooms?: string[];
};

export const walkNodes: WalkNode[] = [
  // Level 2 — Meeting Room Concourse spine, west to east
  { id: "c2-300", x: 300, z: 470, floor: "level2", rooms: ["308", "307", "306", "309", "305", "304", "303", "301"] },
  { id: "c2-foyer", x: 360, z: 520, floor: "level2", rooms: ["402"] },
  { id: "c2-403", x: 432, z: 534, floor: "level2", rooms: ["403A", "403B"] },
  { id: "c2-405", x: 507, z: 534, floor: "level2", rooms: ["405", "407", "404AB", "406AB"] },
  { id: "c2-408", x: 586, z: 534, floor: "level2", rooms: ["408A", "408B"] },
  { id: "c2-409", x: 645, z: 534, floor: "level2", rooms: ["410", "409AB", "411 Theater"] },
  { id: "c2-westlobby", x: 789, z: 470, floor: "level2", rooms: ["West Lobby L2"] },
  // Level 2 — 500s corridor
  { id: "c2-501", x: 743, z: 330, floor: "level2", rooms: ["501ABC", "502A", "502B", "503", "504-507", "508"] },
  { id: "c2-esc5", x: 800, z: 315, floor: "level2" },
  { id: "c2-511", x: 838, z: 330, floor: "level2", rooms: ["511C", "510", "512", "513", "514"] },
  { id: "c2-515", x: 902, z: 372, floor: "level2", rooms: ["515A", "515B", "516", "517", "518", "519"] },
  // Level 1 — Concourse plaza / walkway spine
  { id: "c1-k", x: 290, z: 452, floor: "level1", rooms: ["South Exhibit Hall K", "South Hall K Lobby"] },
  { id: "c1-galaxy", x: 695, z: 440, floor: "level1", rooms: ["Galaxy Court", "West Exhibit Hall B"] },
  { id: "c1-plaza", x: 800, z: 445, floor: "level1", rooms: ["West Exhibit Hall A", "Petree Hall", "Petree C", "Petree D", "Petree D Lobby"] },
  { id: "c1-concourse", x: 600, z: 500, floor: "level1", rooms: ["Concourse Hall"] },
  { id: "c1-foyer", x: 685, z: 528, floor: "level1", rooms: ["Concourse Foyer"] },
  { id: "c1-westlobby", x: 799, z: 504, floor: "level1", rooms: ["West Lobby"] },
];

export const walkEdges: [string, string][] = [
  // Level 2 spine
  ["c2-300", "c2-foyer"],
  ["c2-foyer", "c2-403"],
  ["c2-403", "c2-405"],
  ["c2-405", "c2-408"],
  ["c2-408", "c2-409"],
  ["c2-409", "c2-westlobby"],
  ["c2-westlobby", "c2-esc5"],
  ["c2-501", "c2-esc5"],
  ["c2-esc5", "c2-511"],
  ["c2-511", "c2-515"],
  // Level 1 spine
  ["c1-k", "c1-concourse"],
  ["c1-concourse", "c1-foyer"],
  ["c1-concourse", "c1-galaxy"],
  ["c1-galaxy", "c1-plaza"],
  ["c1-foyer", "c1-westlobby"],
  ["c1-plaza", "c1-westlobby"],
  // Vertical links (escalators/stairs) — extra cost added in the router
  ["c2-westlobby", "c1-westlobby"],
  ["c2-esc5", "c1-plaza"],
  ["c2-foyer", "c1-concourse"],
];

/** Plan-units → meters (South Hall is ~500 m long; diagonal on sheet ~340 units). */
export const UNITS_TO_METERS = 0.55;

/**
 * GPS anchor: maps WGS84 to plan units with a local affine approximation.
 * Anchors: West Lobby entrance (34.03998, -118.26965) ≈ plan (799, 505);
 * Gilbert Lindsay Plaza north edge used for bearing alignment.
 * The sheet's +x axis points roughly NW→SE along Figueroa; rotation ≈ 38° from true north.
 */
export const gpsAnchor = {
  lat: 34.03998,
  lon: -118.26965,
  x: 799,
  z: 505,
  rotationDeg: 38,
  metersPerDegLat: 110922,
  metersPerDegLon: 92385,
};

export const planBounds = { minX: 30, maxX: 1000, minZ: 80, maxZ: 660 };
