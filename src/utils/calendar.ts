import type { ScheduleItem } from "../types";
import { sortByTime } from "./time";

const stamp = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
const escapeIcs = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export const createIcs = (items: ScheduleItem[]): string => {
  const events = sortByTime(items)
    .map((item) =>
      [
        "BEGIN:VEVENT",
        `UID:${item.id}@siggraph-pixel-planner`,
        `DTSTAMP:20260701T120000Z`,
        `DTSTART;TZID=America/Los_Angeles:${stamp(item.date, item.start)}`,
        `DTEND;TZID=America/Los_Angeles:${stamp(item.date, item.end)}`,
        `SUMMARY:${escapeIcs(item.title)}`,
        `LOCATION:${escapeIcs(item.room)}`,
        `DESCRIPTION:${escapeIcs(`${item.program} | ${item.tags.join(", ")} | ${item.sourceUrl}`)}`,
        `URL:${item.sourceUrl}`,
        "END:VEVENT",
      ].join("\r\n"),
    )
    .join("\r\n");

  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SIGGRAPH Pixel Planner//EN", "CALSCALE:GREGORIAN", events, "END:VCALENDAR"].join(
    "\r\n",
  );
};

export const createSummary = (items: ScheduleItem[]): string => {
  if (!items.length) return "My SIGGRAPH Pixel Plan is empty.";
  const lines = sortByTime(items).map((item) => `${item.day} ${item.start}-${item.end} | ${item.room} | ${item.title}`);
  return ["My SIGGRAPH Pixel Plan", ...lines].join("\n");
};
