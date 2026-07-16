import { describe, expect, it } from "vitest";
import { seedScheduleItems } from "../data/schedule";
import { createIcs } from "./calendar";
import { analyzePlan, canAccessProgram, filterSessions } from "./planner";
import { formatMinutes, overlaps, parseMinutes } from "./time";

describe("time helpers", () => {
  it("parses and formats minutes", () => {
    expect(parseMinutes("09:30")).toBe(570);
    expect(formatMinutes(13 * 60 + 5)).toBe("1:05 PM");
  });

  it("detects overlaps", () => {
    const a = seedScheduleItems.find((item) => item.id === "seed-mon-papers")!;
    const b = seedScheduleItems.find((item) => item.id === "seed-mon-course")!;
    expect(overlaps(a, b)).toBe(true);
  });
});

describe("plan analysis", () => {
  it("uses compact, useful alert messages", () => {
    const items = seedScheduleItems.filter((item) => item.date === "2026-07-20");
    const analysis = analyzePlan(items);
    const overlapAlert = analysis.alerts.find((alert) => alert.type === "overlap");
    expect(overlapAlert?.message).toMatch(/AM|PM/);
    expect(overlapAlert?.message).toContain("Technical papers / Fourier tools");
    expect(analysis.alerts.some((alert) => /Gentle|calm|snack/.test(alert.message))).toBe(false);
    expect(["Ambitious", "Chaotic"]).toContain(analysis.personality);
  });
});

describe("registration filtering", () => {
  it("keeps full conference unrestricted", () => {
    expect(canAccessProgram("full", "Technical Paper")).toBe(true);
    expect(canAccessProgram("full", "Exhibition")).toBe(true);
  });

  it("limits discover to public-facing access groups", () => {
    expect(canAccessProgram("discover", "Exhibition")).toBe(true);
    expect(canAccessProgram("discover", "Industry Session")).toBe(true);
    expect(canAccessProgram("discover", "Keynote Speaker")).toBe(true);
    expect(canAccessProgram("discover", "Technical Paper")).toBe(false);
  });

  it("keeps add-on style programs out of experience by default", () => {
    expect(canAccessProgram("experience", "Appy Hour")).toBe(true);
    expect(canAccessProgram("experience", "Frontiers")).toBe(true);
    expect(canAccessProgram("experience", "Computer Animation Festival")).toBe(false);
    expect(canAccessProgram("experience", "Real-Time Live!")).toBe(false);
  });

  it("applies registration filters during search", () => {
    const results = filterSessions(seedScheduleItems, {
      selectedDate: "2026-07-20",
      query: "",
      program: "All",
      floor: "All",
      tags: [],
      liveOnly: false,
      selectedMinutes: 10 * 60,
      registrationType: "discover",
    });
    expect(results.every((item) => canAccessProgram("discover", item.program))).toBe(true);
  });
});

describe("calendar export", () => {
  it("creates a valid ics wrapper", () => {
    const ics = createIcs(seedScheduleItems.slice(0, 1));
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART;TZID=America/Los_Angeles");
  });
});
