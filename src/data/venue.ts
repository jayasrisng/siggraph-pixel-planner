import type { RoomShape } from "../types";
import { rooms3d } from "./venue3d";

// Legacy 2D room shapes, derived from the accurate traced geometry in venue3d.ts
// (bounding boxes of the real footprints). Used by walk estimates and the recap GIF.
export const roomShapes: RoomShape[] = rooms3d
  .filter((room) => room.kind !== "landmark")
  .map((room) => {
    const xs = room.polygon.map(([x]) => x);
    const zs = room.polygon.map(([, z]) => z);
    const minX = Math.min(...xs);
    const minZ = Math.min(...zs);
    return {
      id: room.id,
      label: room.label,
      floor: room.floor,
      x: minX,
      y: minZ,
      width: Math.max(...xs) - minX,
      height: Math.max(...zs) - minZ,
      zone: room.zone,
      amenities: room.amenities as RoomShape["amenities"],
    };
  });

export const offsiteMarker = {
  id: "unmapped",
  label: "Travel / unmapped",
  x: 980,
  y: 620,
};
