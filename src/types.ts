export type FloorId = "level1" | "level2" | "offsite";

export type ScheduleItem = {
  id: string;
  title: string;
  program: string;
  kind?: "conference" | "side-event";
  day: string;
  date: string;
  start: string;
  end: string;
  room: string;
  floor: FloorId;
  tags: string[];
  sourceUrl: string;
  seed: boolean;
  description?: string;
  agenda?: string[];
  speakers?: Array<{
    name: string;
    role?: string;
    profileUrl?: string;
    linkedin?: string;
  }>;
  programPage?: string;
};

export type StickyDropIn = {
  id: string;
  title: string;
  program: string;
  day: string;
  date: string;
  timeLabel: string;
  room: string;
  floor: FloorId;
  tags: string[];
  sourceUrl: string;
  note: string;
};

export type RoomShape = {
  id: string;
  label: string;
  floor: Exclude<FloorId, "offsite">;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate?: number;
  zone: string;
  amenities?: Array<"restroom" | "stairs" | "elevator" | "escalator" | "info" | "food">;
};

export type PlanAlert = {
  type: "overlap" | "tight" | "floor" | "lunch";
  message: string;
  itemIds: string[];
  date: string;
};

export type PlanPersonality = "Calm" | "Ambitious" | "Chaotic";

export type RegistrationType = "full" | "experience" | "discover";
