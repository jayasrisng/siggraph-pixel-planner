import { roomShapes } from "../data/venue";
import type { PlanAlert, PlanPersonality, RegistrationType, ScheduleItem } from "../types";
import { formatMinutes, minutesBetween, overlaps, parseMinutes, sortByTime } from "./time";

const floorLabels: Record<ScheduleItem["floor"], string> = {
  level1: "Level 1",
  level2: "Level 2",
  offsite: "Offsite",
};

const shortTitle = (title: string) =>
  title
    .replace(/^Seed demo:\s*/i, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(" ");

const timeRange = (start: string, end: string) => `${formatMinutes(parseMinutes(start))}-${formatMinutes(parseMinutes(end))}`;

const overlapRange = (a: ScheduleItem, b: ScheduleItem) => {
  const start = Math.max(parseMinutes(a.start), parseMinutes(b.start));
  const end = Math.min(parseMinutes(a.end), parseMinutes(b.end));
  return `${formatMinutes(start)}-${formatMinutes(end)}`;
};

const roomCenter = (room: string) => {
  const shape = roomShapes.find((candidate) => candidate.id === room);
  if (!shape) return null;
  return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2, floor: shape.floor };
};

export const estimateWalkMinutes = (from: ScheduleItem, to: ScheduleItem): number => {
  if (from.floor === "offsite" || to.floor === "offsite") return 18;
  const a = roomCenter(from.room);
  const b = roomCenter(to.room);
  if (!a || !b) return 12;
  const pixels = Math.hypot(a.x - b.x, a.y - b.y);
  const floorPenalty = from.floor !== to.floor ? 6 : 0;
  return Math.max(3, Math.round(pixels / 95) + floorPenalty);
};

export const analyzePlan = (items: ScheduleItem[]) => {
  const timed = sortByTime(items);
  const alerts: PlanAlert[] = [];
  let floorChanges = 0;
  let walkingMinutes = 0;
  let overlapCount = 0;

  for (let i = 0; i < timed.length; i += 1) {
    for (let j = i + 1; j < timed.length; j += 1) {
      if (timed[i].date !== timed[j].date) continue;
      if (parseMinutes(timed[j].start) >= parseMinutes(timed[i].end)) break;
      if (overlaps(timed[i], timed[j])) {
        overlapCount += 1;
        alerts.push({
          type: "overlap",
          itemIds: [timed[i].id, timed[j].id],
          date: timed[i].date,
          message: `${overlapRange(timed[i], timed[j])} - ${shortTitle(timed[i].title)} / ${shortTitle(timed[j].title)}`,
        });
      }
    }
  }

  for (let i = 0; i < timed.length - 1; i += 1) {
    const current = timed[i];
    const next = timed[i + 1];
    if (current.date !== next.date) continue;
    const gap = minutesBetween(current, next);
    const walk = estimateWalkMinutes(current, next);
    walkingMinutes += walk;
    if (current.floor !== next.floor) {
      floorChanges += 1;
      alerts.push({
        type: "floor",
        itemIds: [current.id, next.id],
        date: next.date,
        message: `${formatMinutes(parseMinutes(next.start))} - ${floorLabels[current.floor]} -> ${next.room}`,
      });
    }
    if (gap >= 0 && gap < walk + 5) {
      alerts.push({
        type: "tight",
        itemIds: [current.id, next.id],
        date: next.date,
        message: `${timeRange(current.end, next.start)} - ${walk} min (${current.room} -> ${next.room})`,
      });
    }
  }

  const dates = [...new Set(timed.map((item) => item.date))];
  dates.forEach((date) => {
    const dayItems = timed.filter((item) => item.date === date);
    const hasLunchGap = dayItems.some((item, index) => {
      const next = dayItems[index + 1];
      if (!next) return false;
      const gapStart = parseMinutes(item.end);
      const gapEnd = parseMinutes(next.start);
      return gapEnd - gapStart >= 45 && gapStart <= 14 * 60 && gapEnd >= 11 * 60 + 30;
    });
    if (dayItems.length >= 3 && !hasLunchGap) {
      alerts.push({
        type: "lunch",
        itemIds: dayItems.map((item) => item.id),
        date,
        message: `${date} - no 45 min lunch gap`,
      });
    }
  });

  let personality: PlanPersonality = "Calm";
  if (timed.length >= 7 || overlapCount > 0 || floorChanges >= 3) {
    personality = "Chaotic";
  } else if (timed.length >= 4 || walkingMinutes >= 22 || floorChanges > 0) {
    personality = "Ambitious";
  }

  return { alerts, personality, floorChanges, walkingMinutes };
};

export const filterSessions = (
  sessions: ScheduleItem[],
  options: {
    selectedDate: string;
    query: string;
    program: string;
    floor: string;
    tags: string[];
    liveOnly: boolean;
    selectedMinutes: number;
    registrationType: RegistrationType;
  },
) => {
  const normalized = options.query.trim().toLowerCase();
  return sessions.filter((item) => {
    if (options.selectedDate !== "all" && item.date !== options.selectedDate) return false;
    if (!canAccessProgram(options.registrationType, item.program)) return false;
    if (options.program !== "All" && item.program !== options.program) return false;
    if (options.floor !== "All" && item.floor !== options.floor) return false;
    if (options.tags.length && !options.tags.every((tag) => item.tags.includes(tag))) return false;
    if (normalized) {
      const haystack = `${item.title} ${item.program} ${item.room} ${item.tags.join(" ")}`.toLowerCase();
      if (!haystack.includes(normalized)) return false;
    }
    if (options.liveOnly) {
      const start = parseMinutes(item.start);
      const end = parseMinutes(item.end);
      return start <= options.selectedMinutes && end > options.selectedMinutes;
    }
    return true;
  });
};

const discoverPrograms = new Set([
  "Exhibition",
  "General Conference",
  "Industry Session",
  "Keynote Speaker",
  "SIGGRAPH Presents",
]);

const experiencePrograms = new Set([
  ...discoverPrograms,
  "ACM SIGGRAPH 365",
  "ACM SIGGRAPH Award Talks",
  "Appy Hour",
  "Art Gallery",
  "Art Paper",
  "Birds of a Feather",
  "Educator's Day Session",
  "Educator's Forum",
  "Emerging Technologies",
  "Frontiers",
  "Games Summit",
  "Immersive Pavilion",
  "Pathfinders",
  "Poster",
  "Spatial Storytelling",
  "Stage Session",
  "Side Event",
]);

export const canAccessProgram = (registrationType: RegistrationType, program: string) => {
  if (program === "Side Event") return true;
  if (registrationType === "full") return true;
  if (registrationType === "experience") return experiencePrograms.has(program);
  return discoverPrograms.has(program);
};
