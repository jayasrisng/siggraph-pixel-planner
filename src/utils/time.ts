import type { ScheduleItem } from "../types";

export const parseMinutes = (time: string): number => {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    throw new Error(`Invalid time: ${time}`);
  }
  return h * 60 + m;
};

export const formatMinutes = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
};

export const isActiveAt = (item: ScheduleItem, selectedMinutes: number): boolean =>
  parseMinutes(item.start) <= selectedMinutes && selectedMinutes < parseMinutes(item.end);

export const overlaps = (a: ScheduleItem, b: ScheduleItem): boolean =>
  parseMinutes(a.start) < parseMinutes(b.end) && parseMinutes(b.start) < parseMinutes(a.end);

export const sortByTime = <T extends { date: string; start: string; end: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const dayDelta = a.date.localeCompare(b.date);
    if (dayDelta !== 0) return dayDelta;
    return parseMinutes(a.start) - parseMinutes(b.start) || parseMinutes(a.end) - parseMinutes(b.end);
  });

export const minutesBetween = (a: ScheduleItem, b: ScheduleItem): number =>
  parseMinutes(b.start) - parseMinutes(a.end);
