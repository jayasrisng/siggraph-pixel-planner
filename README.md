# SIGGRAPH Pixel Planner

Polished Vite + React + TypeScript attendee planner for SIGGRAPH 2026 at the Los Angeles Convention Center.

## Setup

```bash
npm install
npm run dev
```

Build and verify:

```bash
npm run lint
npm run test
npm run build
```

## Data

The app expects structured schedule data in `src/data/schedule.ts`. Every timed item must include:

```ts
id, title, program, day, date, start, end, room, floor, tags, sourceUrl
```

The live SIGGRAPH schedule is linked at <https://s2026.conference-schedule.org/>. In this environment the schedule page presented a verification gate, so the checked-in dataset is labeled as seed/demo data and is not presented as official. Replace `seedScheduleItems` with official CSV/JSON-derived entries when an export is available.

Flexible all-day or drop-in items live in `stickyDropIns` and are intentionally excluded from overlap/conflict logic.

## Venue Maps

Map geometry is modeled as responsive SVG room shapes in `src/data/venue.ts`, based on the Los Angeles Convention Center venue map page and PDFs:

- Level 1 Exhibit Halls: <https://www.laconventioncenter.com/assets/doc/LevelOne-ExhibitHalls-41aa5293da.pdf>
- Level 2 Meeting Rooms: <https://www.laconventioncenter.com/assets/doc/LevelTwo-MeetingRooms-d8a1e35187.pdf>

Kentia Hall is intentionally excluded. Only rooms and halls used by the local schedule data are shown.

## GitHub Pages

This Vite project uses `base: "./"` so the built app can be served from a project subpath.

1. Run `npm run build`.
2. Publish the `dist/` folder with your preferred GitHub Pages workflow.
3. For a common Actions setup, upload `dist/` as the Pages artifact after install/test/build.

## Known Limitations

- Official schedule entries are not bundled unless you import an official SIGGRAPH export.
- Room geometry is exact-ish and optimized for planner interaction, not a CAD drawing.
- Walking estimates are based on relative SVG room centers plus floor-change penalties.
