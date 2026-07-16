import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { applyPalette, GIFEncoder, quantize } from "gifenc";
import {
  CalendarDays,
  Check,
  Clock,
  Coffee,
  Copy,
  Download,
  ExternalLink,
  Footprints,
  MapPin,
  Minus,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Route,
  X,
  type LucideIcon,
} from "lucide-react";
import { conferenceDays, dataNotice, officialProgramUrl, scheduleItems, stickyDropIns } from "./data/schedule";
import { offsiteMarker, roomShapes } from "./data/venue";
import { rooms3d } from "./data/venue3d";
import { findDayRoute, roomCenter3d } from "./utils/route3d";
import { createRecapRenderer } from "./utils/recapScene";
import { rasterizeMascot } from "./components/avatar";
import { VenueMap3D } from "./components/VenueMap3D";
import type { MapLayers } from "./components/VenueMap3D";
import { PixelMascot, accessories, avatarPresets, defaultAvatar, palettes } from "./components/avatar";
import type { AvatarConfig } from "./components/avatar";
import type { RegistrationType, ScheduleItem, StickyDropIn } from "./types";
import { createIcs, createSummary } from "./utils/calendar";
import { analyzePlan, canAccessProgram, estimateWalkMinutes, filterSessions } from "./utils/planner";
import { formatMinutes, isActiveAt, parseMinutes, sortByTime } from "./utils/time";
import "./styles.css";

const programs = ["All", ...Array.from(new Set(scheduleItems.map((item) => item.program))).sort()];
const floors = [
  { value: "All", label: "All locations" },
  { value: "level1", label: "Level 1" },
  { value: "level2", label: "Level 2" },
  { value: "offsite", label: "Offsite" },
];
const registrationOptions: Array<{ value: RegistrationType; label: string; note: string }> = [
  { value: "full", label: "Full Conference", note: "All listed programs" },
  { value: "experience", label: "Experience", note: "Experience-access programs" },
  { value: "discover", label: "Discover", note: "Discover-access programs" },
];
const allTags = Array.from(new Set(scheduleItems.flatMap((item) => item.tags))).sort();
type DateScope = "all" | (typeof conferenceDays)[number]["date"];
const conferenceTabs: Array<{ day: string; date: DateScope; short: string }> = [
  { day: "Full conference", date: "all", short: "All" },
  ...conferenceDays.map((day) => ({ ...day, short: day.day.slice(0, 3) })),
];
const localDateIso = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const todayIso = localDateIso(new Date());
const defaultDateScope: DateScope = conferenceDays.some((day) => day.date === todayIso) ? todayIso : conferenceDays[0].date;

const getRoomSessions = (roomId: string, activeSessions: ScheduleItem[]) =>
  activeSessions.filter((item) => item.room === roomId).slice(0, 3);

const zoneClass = (zone: string) => zone.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const roomPolygons = new Map(rooms3d.map((room) => [room.id, room.polygon]));
const mapViewBoxes = {
  level2: { x: 30, y: 230, width: 970, height: 430 },
  level1: { x: 140, y: 70, width: 870, height: 520 },
} as const;

type MobilePanel = "map" | "sessions" | "schedule" | "avatar";

const mobilePanels: Array<{
  id: MobilePanel;
  label: string;
  detail: string;
  icon: LucideIcon;
}> = [
  { id: "map", label: "Map", detail: "3D route", icon: MapPin },
  { id: "sessions", label: "Live", detail: "active sessions", icon: Clock },
  { id: "schedule", label: "Plan", detail: "my schedule", icon: CalendarDays },
  { id: "avatar", label: "Pixel", detail: "avatar", icon: Sparkles },
];


const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    const value = window.localStorage.getItem(key);
    return value ? ({ ...fallback, ...JSON.parse(value) } as T) : fallback;
  } catch {
    return fallback;
  }
};

const readStorageArray = (key: string): string[] => {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
};

const readRegistrationType = (): RegistrationType => {
  try {
    const value = window.localStorage.getItem("siggraphPixelRegistrationType");
    return value === "experience" || value === "discover" || value === "full" ? value : "full";
  } catch {
    return "full";
  }
};

const isRegistrationType = (value: string): value is RegistrationType => value === "experience" || value === "discover" || value === "full";

function PalmTree({ className = "" }: { className?: string }) {
  return (
    <svg className={`palmSvg ${className}`} viewBox="0 0 120 160" aria-hidden="true">
      <path d="M58 158 Q54 110 62 62 L70 63 Q66 112 68 158 Z" fill="#7b573e" stroke="#4a3628" strokeWidth="3" strokeLinejoin="round" />
      <path d="M60 92 H69 M59 118 H68 M58 140 H68" stroke="#5e4a39" strokeWidth="3" strokeLinecap="round" />
      <g stroke="#1e4d3f" strokeWidth="3" strokeLinejoin="round">
        <path d="M66 62 Q36 44 12 56 Q34 30 66 46 Z" fill="#2f6a59" />
        <path d="M66 62 Q96 44 116 58 Q96 30 66 46 Z" fill="#3a7b63" />
        <path d="M66 58 Q48 26 22 24 Q52 12 68 42 Z" fill="#3d8466" />
        <path d="M66 58 Q86 26 110 26 Q82 12 64 42 Z" fill="#2f6a59" />
        <path d="M64 56 Q62 24 78 8 Q84 30 70 52 Z" fill="#46916f" />
      </g>
      <circle cx="60" cy="62" r="5.5" fill="#8c541d" stroke="#4a3628" strokeWidth="2.5" />
      <circle cx="70" cy="66" r="5" fill="#a06a2c" stroke="#4a3628" strokeWidth="2.5" />
    </svg>
  );
}

function Welcome({
  onStart,
  avatar,
  onRegistrationChange,
}: {
  onStart: () => void;
  avatar: AvatarConfig;
  onRegistrationChange: (value: RegistrationType) => void;
}) {
  const [riding, setRiding] = useState(false);
  const [introRegistration, setIntroRegistration] = useState<RegistrationType | "">("");
  const rideBus = () => {
    if (riding) return;
    setRiding(true);
    window.setTimeout(onStart, 2500);
  };
  return (
    <section className="welcome">
      <div className="skyline">
        <div className="sun" />
        <div className="laBlimp">
          <span>Los Angeles Convention Center</span>
        </div>
        <span className="searchlight lightOne" />
        <span className="searchlight lightTwo" />
        <div className="ocean" />
        <div className="sandBand" />
        <div className="hills" />
        <div className="hollywoodSign" aria-hidden="true">
          <span className="signWord">
            {"SIGGRAPH".split("").map((letter, index) => (
              <span key={index} className="signLetter" style={{ animationDelay: `${index * 0.1}s` }}>
                {letter}
              </span>
            ))}
          </span>
          <span className="signSparkle sparkleA">✦</span>
          <span className="signSparkle sparkleB">✦</span>
          <span className="signSparkle sparkleC">✦</span>
        </div>
        <div className="road">
          <span className="lane laneOne" />
          <span className="lane laneTwo" />
          <span className="lane laneThree" />
        </div>
        <div className="laccBuilding">
          <span className="laccTower" />
          <span className="laccRoof" />
          <span className="laccHall" />
          <strong>LACC</strong>
        </div>
        <div
          className={`pixelBus busClickable ${riding ? "busRiding" : ""}`}
          role="button"
          tabIndex={0}
          aria-label="Hop on the pixel bus to LACC"
          title="Hop on!"
          onClick={rideBus}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") rideBus();
          }}
        >
          <span className="busTooltip">Hop on!</span>
          <span className="busSign">TO LACC</span>
          <span className="busWindow w1" />
          <span className="busWindow w2" />
          <span className="busWindow w3" />
          {riding && (
            <span className="busRider">
              <PixelMascot compact avatar={avatar} />
            </span>
          )}
          <span className="busWheel leftWheel" />
          <span className="busWheel rightWheel" />
        </div>
        <div className={`mobileHeroMascot ${riding ? "mascotBoarding" : ""}`}>
          <PixelMascot avatar={avatar} pose="wave" />
        </div>
        <PalmTree className="palmOne" />
        <PalmTree className="palmTwo" />
        <PalmTree className="palmThree" />
        <span className="flash flashOne" />
        <span className="flash flashTwo" />
      </div>
      <a className="officialBadge" href={officialProgramUrl} target="_blank" rel="noreferrer">
        Official SIGGRAPH 2026 program <ExternalLink size={14} />
      </a>
      <div className="welcomeCopy">
        <h1>SIGGRAPH Pixel Planner</h1>
        <p className="dateMarquee">19-23 July 2026</p>
        <p>
          Map the show, catch the talks, ride the pixel bus to LACC, and recap the day like a tiny LA premiere.
        </p>
        <div className="ctaRow">
          <button className="primaryCta" onClick={onStart}>
            <Sparkles size={18} /> Let&apos;s plan with Pixel! <span className="ctaInlineArrow" aria-hidden="true">→</span>
          </button>
          <div className={`ctaMascot ${riding ? "mascotBoarding" : ""}`}>
            <PixelMascot avatar={avatar} pose="wave" />
          </div>
        </div>
        <label className="welcomeRegistration">
          <select
            value={introRegistration}
            onChange={(event) => {
              const value = event.target.value;
              setIntroRegistration(isRegistrationType(value) ? value : "");
              if (isRegistrationType(value)) onRegistrationChange(value);
            }}
            aria-label="Select your registration type"
          >
            <option value="">Select your registration type</option>
            {registrationOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

function VenueMap({
  floor,
  title,
  selectedMinutes,
  sessions,
  highlightedRoom,
  usedRooms,
  layers,
  routeItems = [],
  compact = false,
  onRoomSelect,
}: {
  floor: "level1" | "level2";
  title: string;
  selectedMinutes: number;
  sessions: ScheduleItem[];
  highlightedRoom: string | null;
  usedRooms: Set<string>;
  layers: MapLayers;
  routeItems?: ScheduleItem[];
  compact?: boolean;
  onRoomSelect: (roomId: string) => void;
}) {
  const active = sessions.filter((item) => item.floor === floor && isActiveAt(item, selectedMinutes));
  const shapes = roomShapes.filter((shape) => shape.floor === floor && usedRooms.has(shape.id));
  const viewBox = mapViewBoxes[floor];
  const mapViewBox = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
  const routePoints = routeItems
    .map((item) => {
      const shape = roomShapes.find((room) => room.id === item.room && room.floor === floor);
      if (!shape) return null;
      return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2, label: item.room };
    })
    .filter((point): point is { x: number; y: number; label: string } => Boolean(point));
  const shouldShowAmenity = (amenity: NonNullable<(typeof shapes)[number]["amenities"]>[number]) => {
    if (amenity === "restroom") return layers.restrooms;
    if (amenity === "food") return layers.food;
    if (amenity === "stairs" || amenity === "elevator" || amenity === "escalator") return layers.vertical;
    return layers.vertical;
  };
  const amenityLabel = (amenity: NonNullable<(typeof shapes)[number]["amenities"]>[number]) => {
    if (amenity === "restroom") return "WC";
    if (amenity === "food") return "Food";
    if (amenity === "elevator") return "Elev";
    if (amenity === "escalator") return "Esc";
    if (amenity === "stairs") return "Stairs";
    return "Info";
  };

  return (
    <section className={`mapCard ${compact ? "miniMapCard" : ""}`} aria-label={title}>
      <header>
        <div>
          <p className="eyebrow">{floor === "level2" ? "Meeting rooms" : "Exhibit and concourse"}</p>
          <h2>{title}</h2>
        </div>
        <span className="timePill">{formatMinutes(selectedMinutes)}</span>
      </header>
      <svg className="venueSvg" viewBox={mapViewBox} role="img" aria-label={`${title} interactive venue map`}>
        <rect x="16" y="18" width="1208" height="600" rx="26" className="mapPaper" />
        {floor === "level2" ? (
          <>
            <path d="M34 606 L356 368 L506 482 L182 626 Z" className="buildingGhost southGhost" />
            <path d="M380 382 H1184 V532 H380 Z" className="buildingGhost concourseGhost" />
            <path d="M714 80 H1212 V318 H742 Q708 292 714 246 Z" className="buildingGhost westGhost" />
            <path d="M1096 282 Q1190 298 1202 360 Q1176 414 1088 392 Z" className="buildingGhost accentGhost" />
            <text x="140" y="488" className="zoneLabel" transform="rotate(-37 140 488)">300 rooms</text>
            <text x="612" y="548" className="zoneLabel">Meeting Room Concourse / 400 rooms</text>
            <text x="862" y="112" className="zoneLabel">West Exhibit Hall / 500 rooms</text>
          </>
        ) : (
          <>
            <path d="M90 608 L520 260 L674 444 L230 626 Z" className="buildingGhost southGhost" />
            <path d="M634 82 H1138 V292 H650 Q612 252 634 82 Z" className="buildingGhost westGhost" />
            <path d="M594 364 H1142 V506 H594 Z" className="buildingGhost concourseGhost" />
            <text x="220" y="484" className="zoneLabel" transform="rotate(-38 220 484)">South Exhibit Hall</text>
            <text x="760" y="96" className="zoneLabel">West Exhibit Hall</text>
            <text x="650" y="530" className="zoneLabel">Concourse / Petree / West Lobby</text>
          </>
        )}
        {layers.route && routePoints.length > 1 && (
          <polyline points={routePoints.map((point) => `${point.x},${point.y}`).join(" ")} className="routeLine" />
        )}
        {layers.route &&
          routePoints.map((point, index) => (
            <g key={`${point.label}-${index}`} className="routeStop" aria-hidden="true">
              <circle cx={point.x} cy={point.y} r="10" />
              <text x={point.x} y={point.y + 4} textAnchor="middle">
                {index + 1}
              </text>
            </g>
          ))}
        {shapes.map((shape) => {
          const roomSessions = getRoomSessions(shape.id, active);
          const isActive = roomSessions.length > 0;
          const isHighlighted = highlightedRoom === shape.id;
          const polygon = roomPolygons.get(shape.id);
          const points = polygon ? polygon.map(([px, pz]) => `${px},${pz}`).join(" ") : undefined;
          const centerX = shape.x + shape.width / 2;
          const centerY = shape.y + shape.height / 2;
          return (
            <g key={shape.id}>
              {points ? (
                <polygon
                  points={points}
                  className={`room zone-${zoneClass(shape.zone)} ${isActive ? "activeRoom" : ""} ${isHighlighted ? "highlightRoom" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${shape.label}${isActive ? ` active: ${roomSessions.map((item) => item.title).join(", ")}` : ""}`}
                  onClick={() => onRoomSelect(shape.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") onRoomSelect(shape.id);
                  }}
                />
              ) : (
                <rect
                  x={shape.x}
                  y={shape.y}
                  width={shape.width}
                  height={shape.height}
                  rx="8"
                  className={`room zone-${zoneClass(shape.zone)} ${isActive ? "activeRoom" : ""} ${isHighlighted ? "highlightRoom" : ""}`}
                  onClick={() => onRoomSelect(shape.id)}
                />
              )}
              <text x={centerX} y={centerY + 4} textAnchor="middle" className="roomLabel smallRoomLabel">
                {shape.label}
              </text>
              {isActive && <circle cx={centerX} cy={shape.y + 6} r="5" className="activeRoomDot" />}
              {shape.amenities?.filter(shouldShowAmenity).map((amenity, amenityIndex) => (
                <g key={`${shape.id}-${amenity}`} className={`amenityChip ${amenity}`} aria-hidden="true">
                  <rect x={centerX - 18 + amenityIndex * 40} y={shape.y + shape.height - 6} width="36" height="14" rx="7" />
                  <text x={centerX + amenityIndex * 40} y={shape.y + shape.height + 4} textAnchor="middle">
                    {amenityLabel(amenity)}
                  </text>
                </g>
              ))}
              <title>
                {roomSessions.length
                  ? `${shape.label}: ${roomSessions.map((item) => item.title).join(" | ")}`
                  : `${shape.label}: no active session at selected time`}
              </title>
            </g>
          );
        })}
        <circle cx={offsiteMarker.x} cy={offsiteMarker.y} r="22" className="travelDot" />
      </svg>
      {!compact && active.length > 0 && (
        <div className="activeRoomList">
          {active.slice(0, 6).map((item) => (
            <button key={item.id} onClick={() => onRoomSelect(item.room)} title={item.title}>
              <strong>{item.room}</strong>
              <span>{item.title}</span>
            </button>
          ))}
          {active.length > 6 && <span className="moreActive">+{active.length - 6} more active sessions</span>}
        </div>
      )}
    </section>
  );
}

function SessionCard({
  item,
  selected,
  attended,
  onTogglePlan,
  onToggleAttended,
  onHover,
  onDetails,
}: {
  item: ScheduleItem;
  selected: boolean;
  attended: boolean;
  onTogglePlan: () => void;
  onToggleAttended: () => void;
  onHover: (room: string | null) => void;
  onDetails: () => void;
}) {
  return (
    <article
      id={`session-${item.id}`}
      className={`sessionRow ${selected ? "selectedCard" : ""}`}
      onMouseEnter={() => onHover(item.room)}
      onMouseLeave={() => onHover(null)}
      onDoubleClick={onDetails}
    >
      <div className="sessionWhen">
        <strong>{item.start}</strong>
        <span>{item.end}</span>
      </div>
      <div className="sessionBody">
        <h3 onClick={onDetails}>{item.title}</h3>
        <p className="meta">
          <span className="programChip">{item.program}</span>
          <MapPin size={12} /> {item.room}
          {item.floor === "offsite" && <em> (offsite)</em>}
        </p>
      </div>
      <div className="rowActions">
        <button
          className={selected ? "rowIconButton removeButton" : "rowIconButton addButton"}
          onClick={onTogglePlan}
          aria-label={selected ? `Remove ${item.title} from plan` : `Add ${item.title} to plan`}
          title={selected ? "Remove from plan" : "Add to plan"}
        >
          {selected ? <Minus size={15} /> : <Plus size={15} />}
        </button>
        {selected && (
          <button
            className={`rowIconButton ${attended ? "attended" : ""}`}
            onClick={onToggleAttended}
            aria-label={`Mark ${item.title} attended`}
            title="Mark attended"
          >
            <Check size={15} />
          </button>
        )}
        <button className="rowIconButton" onClick={onDetails} aria-label={`Open details for ${item.title}`} title="Details">
          <ExternalLink size={15} />
        </button>
      </div>
    </article>
  );
}

const timeBlocks: Array<{ id: string; label: string; test: (startMinutes: number) => boolean }> = [
  { id: "morning", label: "Morning", test: (minutes) => minutes < 12 * 60 },
  { id: "afternoon", label: "Afternoon", test: (minutes) => minutes >= 12 * 60 && minutes < 17 * 60 },
  { id: "evening", label: "Evening", test: (minutes) => minutes >= 17 * 60 },
];

function SessionGroups({
  items,
  planIds,
  attendedIds,
  onTogglePlan,
  onToggleAttended,
  onHover,
  onDetails,
}: {
  items: ScheduleItem[];
  planIds: string[];
  attendedIds: Set<string>;
  onTogglePlan: (id: string) => void;
  onToggleAttended: (id: string) => void;
  onHover: (room: string | null) => void;
  onDetails: (item: ScheduleItem) => void;
}) {
  const sorted = sortByTime(items);
  return (
    <>
      {timeBlocks.map((block) => {
        const blockItems = sorted.filter((item) => block.test(parseMinutes(item.start)));
        if (!blockItems.length) return null;
        return (
          <details key={block.id} className="sessionBlock" open>
            <summary>
              {block.label} <span className="blockCount">{blockItems.length}</span>
            </summary>
            {blockItems.map((item) => (
              <SessionCard
                key={item.id}
                item={item}
                selected={planIds.includes(item.id)}
                attended={attendedIds.has(item.id)}
                onTogglePlan={() => onTogglePlan(item.id)}
                onToggleAttended={() => onToggleAttended(item.id)}
                onHover={onHover}
                onDetails={() => onDetails(item)}
              />
            ))}
          </details>
        );
      })}
    </>
  );
}

function SessionDetailModal({ item, onClose }: { item: ScheduleItem; onClose: () => void }) {
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-labelledby="session-detail-title">
      <div className="detailModal">
        <header>
          <div>
            <p className="eyebrow">{item.program}</p>
            <h2 id="session-detail-title">{item.title}</h2>
          </div>
          <button className="iconButton" onClick={onClose} aria-label="Close session details">
            <X size={20} />
          </button>
        </header>
        <div className="detailBody">
          <p className="detailMeta">{item.day} {item.start}-{item.end} | {item.room}</p>
          {item.seed && (
            <p className="officialWarning">
              This is seed detail, not official SIGGRAPH copy. The official schedule page is verification-gated here, so real agenda,
              speakers, LinkedIns, and program-page URLs need to be imported from an official export.
            </p>
          )}
          {item.description && <p className="sessionDescription">{item.description}</p>}
          <div className="tagRow detailTags">
            {item.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          {(() => {
            // Official imports often mirror the description into the agenda — skip duplicates.
            const agendaEntries = (item.agenda ?? []).filter(
              (entry) => entry.trim() !== (item.description ?? "").trim(),
            );
            if (!agendaEntries.length) return null;
            return (
              <section>
                <h3>Agenda</h3>
                <ol className="agendaList">
                  {agendaEntries.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ol>
              </section>
            );
          })()}
          <section>
            <h3>Speakers</h3>
            {item.speakers?.length ? (
              <div className="speakerGrid">
                {item.speakers.map((speaker) => (
                  <a key={speaker.name} href={speaker.linkedin ?? speaker.profileUrl ?? item.sourceUrl} target="_blank" rel="noreferrer">
                    <strong>{speaker.name}</strong>
                    <span>{speaker.linkedin ? "LinkedIn" : speaker.role ?? "Official profile"}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="mutedText">Speaker names and LinkedIn URLs are pending official import.</p>
            )}
          </section>
          <div className="detailActions">
            <a href={item.programPage ?? item.sourceUrl} target="_blank" rel="noreferrer">
              Open official program page <ExternalLink size={15} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function DropInNote({
  selectedDropInIds,
  onToggleDropIn,
  onPosters,
}: {
  selectedDropInIds: string[];
  onToggleDropIn: (id: string) => void;
  onPosters: () => void;
}) {
  return (
    <section className="dropInNote" aria-label="Flexible drop-ins">
      <div>
        <p className="eyebrow">Flexible drop-ins</p>
        <h3>Checklist</h3>
        <div className="dropInChecklist">
          {stickyDropIns.map((item) => (
            <label key={item.id}>
              <input type="checkbox" checked={selectedDropInIds.includes(item.id)} onChange={() => onToggleDropIn(item.id)} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.timeLabel} | {item.room}</small>
              </span>
            </label>
          ))}
        </div>
      </div>
      <button className="ghostButton" onClick={onPosters}>Poster timing notes</button>
    </section>
  );
}

function PosterModal({ posterItems, onClose }: { posterItems: ScheduleItem[]; onClose: () => void }) {
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-labelledby="poster-title">
      <div className="detailModal compactDetail">
        <header>
          <div>
            <p className="eyebrow">Posters</p>
            <h2 id="poster-title">Poster blocks</h2>
          </div>
          <button className="iconButton" onClick={onClose} aria-label="Close poster notes">
            <X size={20} />
          </button>
        </header>
        <div className="detailBody">
          <p>Poster blocks from the imported official schedule are searchable as timed rows. Use the checklist note for casual poster browsing and the exact rows when you want calendar/conflict behavior.</p>
          <ul className="agendaList">
            {posterItems.slice(0, 14).map((item) => (
              <li key={item.id}>
                <strong>{item.day} {item.start}-{item.end}</strong> | {item.room} | {item.title}
              </li>
            ))}
          </ul>
          <div className="detailActions">
            <a href={officialProgramUrl} target="_blank" rel="noreferrer">
              Check official SIGGRAPH program <ExternalLink size={15} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanPanel({
  selectedItems,
  selectedDropIns,
  attendedIds,
  onRemove,
  onToggleAttended,
  onWalk,
  avatar,
  onAvatarChange,
  mobilePanel,
}: {
  selectedItems: ScheduleItem[];
  selectedDropIns: StickyDropIn[];
  attendedIds: Set<string>;
  onRemove: (id: string) => void;
  onToggleAttended: (id: string) => void;
  onWalk: () => void;
  avatar: AvatarConfig;
  onAvatarChange: (avatar: AvatarConfig) => void;
  mobilePanel: MobilePanel;
}) {
  const analysis = useMemo(() => analyzePlan(selectedItems), [selectedItems]);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const alertGroups = useMemo(() => {
    const labels: Record<(typeof analysis.alerts)[number]["type"], { label: string; icon: string }> = {
      overlap: { label: "Overlaps", icon: "!" },
      tight: { label: "Tight walks", icon: "!" },
      floor: { label: "Floor changes", icon: "i" },
      lunch: { label: "Breaks", icon: "i" },
    };
    return Object.entries(
      analysis.alerts.reduce(
        (groups, alert) => {
          const spansMultipleDates = new Set(selectedItems.map((item) => item.date)).size > 1;
          const datePrefix = spansMultipleDates ? `${alert.date.slice(5).replace("-", "/")} ` : "";
          groups[alert.type] = [...(groups[alert.type] ?? []), `${datePrefix}${alert.message}`];
          return groups;
        },
        {} as Partial<Record<(typeof analysis.alerts)[number]["type"], string[]>>,
      ),
    ).map(([type, messages]) => ({
      type: type as (typeof analysis.alerts)[number]["type"],
      messages,
      ...labels[type as (typeof analysis.alerts)[number]["type"]],
    }));
  }, [analysis.alerts, selectedItems]);
  const alertCount = alertGroups.reduce((sum, group) => sum + group.messages.length, 0);
  const showPlanDates = new Set(selectedItems.map((item) => item.date)).size > 1;

  const downloadIcs = () => {
    const blob = new Blob([createIcs(selectedItems)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "siggraph-pixel-plan.ics";
    link.click();
    URL.revokeObjectURL(url);
  };

  const copySummary = async () => {
    setCopyState("copied");
    try {
      await navigator.clipboard.writeText(createSummary(selectedItems));
    } catch {
      // The visual confirmation still helps in browser contexts that block clipboard writes.
    }
    window.setTimeout(() => setCopyState("idle"), 1400);
  };

  const [gifBusy, setGifBusy] = useState(false);

  const downloadGif = async () => {
    if (gifBusy) return;
    setGifBusy(true);
    try {
      await generateRecapGif();
    } finally {
      setGifBusy(false);
    }
  };

  const generateRecapGif = async () => {
    // Logical layout space stays 800x450; SCALE renders everything at higher resolution.
    const width = 800;
    const height = 450;
    const SCALE = 1.5;
    const mapTop = 52;
    const mapHeight = 332;
    const canvas = document.createElement("canvas");
    canvas.width = width * SCALE;
    canvas.height = height * SCALE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(SCALE, SCALE);

    const attendedItems = sortByTime(selectedItems.filter((item) => attendedIds.has(item.id)));
    const recapItems = attendedItems.length ? attendedItems : sortByTime(selectedItems);
    if (!recapItems.length) return;
    const recapStats = analyzePlan(recapItems);

    // The user's exact character, rasterized from the same SVG the app renders.
    const mascotIdle = await rasterizeMascot(avatar, "idle", 420);
    const mascotWave = await rasterizeMascot(avatar, "wave", 420);

    const gif = GIFEncoder();
    const paletteColors = 256;
    const pushFrame = (delay = 110) => {
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const palette = quantize(image.data, paletteColors);
      const index = applyPalette(image.data, palette);
      gif.writeFrame(index, canvas.width, canvas.height, { palette, delay, repeat: 0 });
    };
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

    const drawHeader = (subtitle: string) => {
      ctx.fillStyle = "#f8efd8";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#1e2528";
      ctx.font = "800 20px Arial";
      ctx.textAlign = "start";
      ctx.fillText(`my SIGGRAPH 2026 - with ${avatar.name || "Pixel"}`, 24, 32);
      ctx.font = "13px Arial";
      ctx.fillStyle = "#40545a";
      ctx.textAlign = "end";
      ctx.fillText(subtitle, width - 24, 32);
      ctx.textAlign = "start";
    };

    const wrapTitle = (text: string, max: number): string[] => {
      const words = text.split(" ");
      const lines: string[] = [""];
      words.forEach((word) => {
        const candidate = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
        if (candidate.length > max && lines[lines.length - 1]) lines.push(word);
        else lines[lines.length - 1] = candidate;
      });
      return lines.slice(0, 2).map((line, i, all) => (i === 1 && all.length > 1 && text.length > max * 2 ? `${line.slice(0, max - 3)}...` : line));
    };

    const drawStopCard = (index: number, title: string, place: string) => {
      const lines = wrapTitle(title.replace("Seed demo: ", ""), 52);
      const cardHeight = lines.length > 1 ? 78 : 58;
      const y = height - cardHeight - 10;
      ctx.fillStyle = "rgba(255,246,231,.96)";
      ctx.beginPath();
      ctx.roundRect(24, y, width - 48, cardHeight, 14);
      ctx.fill();
      ctx.strokeStyle = "rgba(30,37,40,.2)";
      ctx.lineWidth = 2;
      ctx.stroke();
      // stop number badge
      ctx.fillStyle = "#e87961";
      ctx.beginPath();
      ctx.arc(52, y + cardHeight / 2, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff6e7";
      ctx.font = "800 15px Arial";
      ctx.textAlign = "center";
      ctx.fillText(String(index), 52, y + cardHeight / 2 + 5);
      ctx.textAlign = "start";
      // session title BIG, place small underneath
      ctx.fillStyle = "#1e2528";
      ctx.font = "800 21px Arial";
      lines.forEach((line, i) => ctx.fillText(line, 82, y + 28 + i * 24));
      ctx.fillStyle = "#40545a";
      ctx.font = "700 13px Arial";
      ctx.fillText(place, 82, y + cardHeight - 12);
    };

    // ---------- Chapter 1: hop on the bus, ride to LACC ----------
    const busFrames = 14;
    const hopFrames = 5;
    for (let frame = 0; frame < busFrames; frame += 1) {
      drawHeader(`${recapItems.length} ${attendedItems.length ? "places attended" : "planned stops"} across the week`);
      ctx.fillStyle = "#f2ad83";
      ctx.fillRect(0, 60, width, 156);
      ctx.fillStyle = "#537b61";
      ctx.beginPath();
      ctx.moveTo(30, 216);
      ctx.lineTo(230, 100);
      ctx.lineTo(420, 216);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffd173";
      ctx.beginPath();
      ctx.arc(700, 104, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d9edf0";
      ctx.fillRect(620, 132, 130, 84);
      ctx.strokeStyle = "#40545a";
      ctx.lineWidth = 4;
      ctx.strokeRect(620, 132, 130, 84);
      ctx.fillStyle = "#f8d6c9";
      ctx.fillRect(638, 108, 94, 26);
      ctx.strokeRect(638, 108, 94, 26);
      ctx.fillStyle = "#184f68";
      ctx.font = "800 18px Arial";
      ctx.fillText("LACC", 656, 190);
      ctx.fillStyle = "#40545a";
      ctx.fillRect(0, 216, width, 66);
      ctx.strokeStyle = "#fff6e7";
      ctx.setLineDash([22, 18]);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 250);
      ctx.lineTo(width, 250);
      ctx.stroke();
      ctx.setLineDash([]);
      const riding = frame >= hopFrames;
      const progress = riding ? (frame - hopFrames) / (busFrames - hopFrames - 1) : 0;
      const busX = 130 + progress * 380;
      // bus body
      ctx.fillStyle = "#f49a1f";
      ctx.beginPath();
      ctx.roundRect(busX, 188, 140, 56, 8);
      ctx.fill();
      ctx.strokeStyle = "#1e2528";
      ctx.lineWidth = 4;
      ctx.stroke();
      // window strip
      ctx.fillStyle = "#d9edf0";
      ctx.fillRect(busX + 12, 197, 100, 20);
      ctx.strokeStyle = "#1e2528";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(busX + 12, 197, 100, 20);
      if (riding) {
        // the user's real character riding: head peeking through the window
        ctx.save();
        ctx.beginPath();
        ctx.rect(busX + 12, 197, 100, 20);
        ctx.clip();
        const mh = 64;
        const mw = (mh * mascotIdle.width) / mascotIdle.height;
        ctx.drawImage(mascotIdle, busX + 48, 194 + Math.sin(frame * 0.9) * 1.5, mw, mh);
        ctx.restore();
      }
      ctx.fillStyle = "#101719";
      ctx.beginPath();
      ctx.arc(busX + 32, 248, 9, 0, Math.PI * 2);
      ctx.arc(busX + 110, 248, 9, 0, Math.PI * 2);
      ctx.fill();
      if (!riding) {
        // real mascot hops toward the door with a little tilt
        const t = frame / hopFrames;
        const px = 44 + t * 66;
        const py = 168 - Math.abs(Math.sin(t * Math.PI * 2)) * 16;
        const mh = 92;
        const mw = (mh * mascotIdle.width) / mascotIdle.height;
        ctx.save();
        ctx.translate(px + mw / 2, py + mh / 2);
        ctx.rotate(frame % 2 === 0 ? 0.05 : -0.05);
        ctx.drawImage(frame % 2 === 0 ? mascotIdle : mascotWave, -mw / 2, -mh / 2, mw, mh);
        ctx.restore();
      }
      ctx.fillStyle = "#40545a";
      ctx.font = "700 14px Arial";
      ctx.fillText(riding ? "Riding to the Los Angeles Convention Center..." : "Hopping on the pixel bus!", 40, 322);
      pushFrame(riding && frame === busFrames - 1 ? 320 : 110);
    }

    // ---------- Day chapters in the real 3D venue ----------
    const recap = createRecapRenderer((width - 48) * SCALE, mapHeight * SCALE, [mascotIdle, mascotWave]);
    let angle = 0.55;
    const OVERVIEW = { radius: 560, height: 470 };
    const CLOSE = { radius: 150, height: 120 };

    const renderMapFrame = (
      focus: { x: number; z: number },
      radius: number,
      camHeight: number,
      avatarPos: { x: number; y: number; z: number } | null,
      poseIndex: number,
      bob: number,
      caption: { index: number; title: string; place: string } | null,
      subtitle: string,
      delay = 110,
    ) => {
      angle += 0.022;
      recap.setAvatar(avatarPos, bob, poseIndex);
      recap.render(focus, angle, radius, camHeight);
      drawHeader(subtitle);
      ctx.drawImage(recap.canvas, 24, mapTop, width - 48, mapHeight);
      ctx.strokeStyle = "rgba(30,37,40,.2)";
      ctx.lineWidth = 2;
      ctx.strokeRect(24, mapTop, width - 48, mapHeight);
      if (caption) drawStopCard(caption.index, caption.title, caption.place);
      pushFrame(delay);
    };

    conferenceDays.forEach((day) => {
      const dayItems = recapItems.filter((item) => item.date === day.date);
      if (!dayItems.length) return;
      // day title card
      drawHeader(day.date);
      ctx.fillStyle = "#1e2528";
      ctx.font = "800 54px Arial";
      ctx.textAlign = "center";
      ctx.fillText(day.day, width / 2, 208);
      ctx.font = "700 20px Arial";
      ctx.fillStyle = "#40545a";
      ctx.fillText(`${dayItems.length} stop${dayItems.length > 1 ? "s" : ""}`, width / 2, 248);
      ctx.textAlign = "start";
      pushFrame(340);

      const mapped = dayItems.filter((item) => roomCenter3d(item.room));
      const roomsSeq = mapped.map((item) => item.room);
      const legs = roomsSeq.length > 1 ? findDayRoute(roomsSeq) : [];
      recap.setDay(roomsSeq, legs.flatMap((leg) => leg.points));
      const centers = roomsSeq.map((room) => recap.roomCenter(room)!);
      const dayFocus = centers.length
        ? { x: centers.reduce((s, c) => s + c.x, 0) / centers.length, z: centers.reduce((s, c) => s + c.z, 0) / centers.length }
        : { x: 640, z: 420 };
      const subtitle = `${day.day} - ${day.date}`;

      // overview: the day's route revealed
      for (let step = 0; step < 2; step += 1) {
        renderMapFrame(dayFocus, OVERVIEW.radius, OVERVIEW.height, null, 0, 0, null, subtitle, 150);
      }

      let stopNumber = 0;
      dayItems.forEach((item) => {
        stopNumber += 1;
        const caption = { index: stopNumber, title: item.title, place: `${item.room}${roomCenter3d(item.room) ? "" : " (offsite)"}` };
        const center = recap.roomCenter(item.room);
        if (!center) {
          // offsite: hold the overview with the caption card
          renderMapFrame(dayFocus, OVERVIEW.radius, OVERVIEW.height, null, 0, 0, caption, subtitle, 300);
          return;
        }
        const mappedIndex = roomsSeq.indexOf(item.room);
        // travel: follow the corridor from the previous stop
        if (mappedIndex > 0 && legs[mappedIndex - 1]) {
          const points = legs[mappedIndex - 1].points;
          const totals: number[] = [0];
          for (let i = 1; i < points.length; i += 1) {
            totals.push(totals[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
          }
          const total = totals[totals.length - 1] || 1;
          for (let step = 1; step <= 3; step += 1) {
            const target = (step / 3) * total;
            let seg = 1;
            while (seg < points.length - 1 && totals[seg] < target) seg += 1;
            const local = (target - totals[seg - 1]) / Math.max(1, totals[seg] - totals[seg - 1]);
            const pos = {
              x: points[seg - 1].x + (points[seg].x - points[seg - 1].x) * local,
              y: points[seg - 1].y + (points[seg].y - points[seg - 1].y) * local,
              z: points[seg - 1].z + (points[seg].z - points[seg - 1].z) * local,
            };
            renderMapFrame({ x: pos.x, z: pos.z }, 300, 240, pos, step % 2, step * 1.5, caption, subtitle, 105);
          }
        }
        // swoop in: overview/medium -> close-up hero shot of the place
        for (let step = 1; step <= 3; step += 1) {
          const t = ease(step / 3);
          const radius = 300 + (CLOSE.radius - 300) * t;
          const camHeight = 240 + (CLOSE.height - 240) * t;
          renderMapFrame(
            { x: center.x, z: center.z },
            radius,
            camHeight,
            { x: center.x, y: center.top, z: center.z },
            1,
            step,
            caption,
            subtitle,
            step === 3 ? 130 : 105,
          );
        }
        // dwell: slow close orbit, avatar waving on the roof
        for (let step = 0; step < 3; step += 1) {
          renderMapFrame(
            { x: center.x, z: center.z },
            CLOSE.radius,
            CLOSE.height,
            { x: center.x, y: center.top, z: center.z },
            step % 2,
            step * 1.2,
            caption,
            subtitle,
            step === 2 ? 300 : 140,
          );
        }
      });
    });
    recap.dispose();

    // ---------- End card ----------
    const funLine =
      recapStats.personality === "Chaotic"
        ? "Loads of conversations!"
        : recapStats.personality === "Ambitious"
          ? "Lots of pictures, bigger ideas."
          : "Smooth days, happy brain.";
    for (let step = 0; step < 3; step += 1) {
      drawHeader("that's a wrap!");
      const mh = 260;
      const mw = (mh * mascotWave.width) / mascotWave.height;
      ctx.drawImage(step % 2 === 0 ? mascotWave : mascotIdle, 104, 120 + Math.sin(step * 1.3) * 3, mw, mh);
      ctx.fillStyle = "#1e2528";
      ctx.font = "800 46px Arial";
      ctx.fillText("my SIGGRAPH 2026", 316, 140);
      ctx.font = "700 21px Arial";
      ctx.fillStyle = "#40545a";
      ctx.fillText("Los Angeles, California", 316, 178);
      ctx.fillText("19-23 July 2026", 316, 206);
      ctx.font = "800 24px Arial";
      ctx.fillStyle = "#b56a4d";
      ctx.fillText(`with ${avatar.name || "Pixel"}`, 316, 248);
      ctx.font = "700 17px Arial";
      ctx.fillStyle = "#40545a";
      ctx.fillText(
        `${recapItems.length} session${recapItems.length > 1 ? "s" : ""} | ${recapStats.floorChanges} floor changes | about ${recapStats.walkingMinutes} walk minutes`,
        316,
        288,
      );
      ctx.font = "italic 700 23px Georgia";
      ctx.fillStyle = "#b56a4d";
      ctx.fillText(`"${funLine}"`, 316, 328);
      ctx.font = "700 14px Arial";
      ctx.fillStyle = "#9db6bd";
      ctx.fillText("made with SIGGRAPH Pixel Planner", 316, 366);
      pushFrame(step === 2 ? 3000 : 300);
    }

    gif.finish();
    const gifBytes = gif.bytes();
    const gifCopy = new Uint8Array(gifBytes.byteLength);
    gifCopy.set(gifBytes);
    const blob = new Blob([gifCopy.buffer], { type: "image/gif" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "siggraph-pixel-recap.gif";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className={`planPanel planPanelMode-${mobilePanel}`}>
      <div className="planHeader">
        <div>
          <p className="eyebrow">My Pixel Plan</p>
          <h2>{analysis.personality}</h2>
        </div>
        <PixelMascot compact avatar={avatar} />
      </div>
      <div className="avatarBuilder planAvatarSection">
        <p><SlidersHorizontal size={14} /> You can also change your Pixel avatar look</p>
        <div className="presetRow" aria-label="Character preset">
          {avatarPresets.map((preset) => (
            <button
              key={preset.id}
              className={`presetButton ${avatar.preset === preset.id ? "activePreset" : ""}`}
              onClick={() => onAvatarChange({ ...avatar, preset: preset.id })}
              title={preset.emojiHint}
            >
              <PixelMascot compact avatar={{ ...avatar, preset: preset.id }} />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
        <label>
          Name
          <input value={avatar.name} onChange={(event) => onAvatarChange({ ...avatar, name: event.target.value || "Pixel" })} />
        </label>
        <div className="swatches">
          {(
            [
              ["Outfit", "hoodie", palettes.hoodie],
              ["Bottom", "pants", palettes.pants],
              ["Hair", "hair", palettes.hair],
              ["Skin", "skin", palettes.skin],
            ] as Array<[string, keyof AvatarConfig, string[]]>
          ).map(([label, key, values]) => (
            <fieldset key={key}>
              <legend>{label}</legend>
              {values.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={avatar[key] === value ? "activeSwatch" : ""}
                  style={{ backgroundColor: value }}
                  aria-label={`${label} ${value}`}
                  onClick={() => onAvatarChange({ ...avatar, [key]: value })}
                />
              ))}
            </fieldset>
          ))}
        </div>
        {avatar.preset === "kid" && (
          <div className="hairStyles" aria-label="Hair style">
            {[
              ["swoop", "Swoop"],
              ["puffs", "Puffs"],
              ["waves", "Waves"],
              ["short", "Short"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={avatar.hairStyle === value ? "activeSegment" : ""}
                onClick={() => onAvatarChange({ ...avatar, hairStyle: value as AvatarConfig["hairStyle"] })}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="hairStyles" aria-label="Accessory">
          {accessories.map((item) => (
            <button
              key={item.id}
              className={avatar.accessory === item.id ? "activeSegment" : ""}
              onClick={() => onAvatarChange({ ...avatar, accessory: item.id })}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button className="pixelGifButton" disabled={(!selectedItems.length && !selectedDropIns.length) || gifBusy} onClick={downloadGif}>
          <Sparkles size={16} /> {gifBusy ? "Rendering recap..." : "Download recap GIF"}
        </button>
      </div>
      <div className="planScheduleSection">
        <p className="planStats">
          {selectedItems.length} sessions | {analysis.floorChanges} floor changes | about {analysis.walkingMinutes} walk minutes
        </p>
        <div className="planList">
          {sortByTime(selectedItems).map((item, index) => (
            <div key={item.id} className="planItem">
              <span className="stopNumber">{index + 1}</span>
              <div>
                <strong>{showPlanDates ? `${item.date.slice(5).replace("-", "/")} ` : ""}{item.start} {item.title.replace("Seed demo: ", "")}</strong>
                <p>{item.room}</p>
              </div>
              <button aria-label={`Remove ${item.title}`} onClick={() => onRemove(item.id)}>
                <X size={14} />
              </button>
              <button
                className={attendedIds.has(item.id) ? "tinyAttended" : ""}
                aria-label={`Mark ${item.title} attended`}
                onClick={() => onToggleAttended(item.id)}
              >
                <Check size={14} />
              </button>
            </div>
          ))}
          {!selectedItems.length && <p className="emptyPlan">Add sessions to start your day path.</p>}
        </div>
        {alertGroups.length > 0 && (
          <div className="alerts" aria-label="Plan alerts">
            <details className="alertGroup alertSummaryGroup">
              <summary>
                <span className="alertPills" aria-label={`${alertCount} plan notes`}>
                  {alertGroups.map((group) => (
                    <span key={group.type} className={`alertMini alert-${group.type}`}>
                      <span aria-hidden="true">{group.icon}</span>
                      {group.messages.length}
                    </span>
                  ))}
                </span>
                <strong>Plan notes</strong>
              </summary>
              <div className="alertDetails">
                {alertGroups.map((group) => (
                  <details key={group.type} className="alertTypeGroup" open>
                    <summary>
                      <h3>{group.label}</h3>
                      <span>{group.messages.length}</span>
                    </summary>
                    {group.messages.map((message, index) => (
                      <p key={`${group.type}-${index}`}>{message}</p>
                    ))}
                  </details>
                ))}
              </div>
            </details>
          </div>
        )}
        <div className="planActions">
          <button className="primarySmall" disabled={!selectedItems.length} onClick={onWalk}>
            <Footprints size={16} /> Walk my day
          </button>
          <button disabled={!selectedItems.length} onClick={downloadIcs}>
            <Download size={16} /> Calendar File
          </button>
          <button className={copyState === "copied" ? "copiedButton" : ""} disabled={!selectedItems.length} onClick={copySummary}>
            {copyState === "copied" ? <Check size={16} /> : <Copy size={16} />} {copyState === "copied" ? "Copied!" : "Copy Summary"}
          </button>
          <button className="desktopGifButton" disabled={(!selectedItems.length && !selectedDropIns.length) || gifBusy} onClick={downloadGif}>
            <Sparkles size={16} /> {gifBusy ? "Rendering recap..." : "Download GIF"}
          </button>
        </div>
      </div>
    </aside>
  );
}

function RouteModal({
  items,
  onClose,
  usedRooms,
  avatar,
  layers,
}: {
  items: ScheduleItem[];
  onClose: () => void;
  usedRooms: Set<string>;
  avatar: AvatarConfig;
  layers: MapLayers;
}) {
  const [step, setStep] = useState(0);
  const [speed, setSpeed] = useState(1);
  const ordered = sortByTime(items);
  const current = ordered[step] ?? ordered[0];
  const next = ordered[step + 1];
  const currentShape = roomShapes.find((shape) => shape.id === current?.room);
  const avatarStyleFor = (floor: "level1" | "level2") => {
    if (!currentShape || currentShape.floor !== floor) return undefined;
    const viewBox = mapViewBoxes[floor];
    return {
      left: `${((currentShape.x + currentShape.width / 2 - viewBox.x) / viewBox.width) * 100}%`,
      top: `${((currentShape.y + currentShape.height / 2 - viewBox.y) / viewBox.height) * 100}%`,
      transitionDuration: `${0.8 / speed}s`,
    };
  };

  useEffect(() => {
    if (!ordered.length) return undefined;
    const timer = window.setInterval(() => {
      setStep((value) => (value + 1) % ordered.length);
    }, 2400 / speed);
    return () => window.clearInterval(timer);
  }, [ordered.length, speed]);

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-labelledby="route-title">
      <div className="routeModal">
        <header>
          <div>
            <p className="eyebrow">Walk my day</p>
            <h2 id="route-title">Pixel route preview</h2>
          </div>
          <button className="iconButton" onClick={onClose} aria-label="Close route preview">
            <X size={20} />
          </button>
        </header>
        <div className="routeGrid">
          <div className="miniStack">
            <div className="miniMapShell">
              <VenueMap
                compact
                floor="level2"
                title="Mini Level 2"
                selectedMinutes={current ? parseMinutes(current.start) : 570}
                sessions={ordered}
                highlightedRoom={current?.room ?? null}
                usedRooms={usedRooms}
                layers={layers}
                routeItems={ordered}
                onRoomSelect={() => undefined}
              />
              {avatarStyleFor("level2") && (
                <div className="routeMascot" style={avatarStyleFor("level2")}>
                  <PixelMascot compact avatar={avatar} />
                </div>
              )}
            </div>
            <div className="miniMapShell">
              <VenueMap
                compact
                floor="level1"
                title="Mini Level 1"
                selectedMinutes={current ? parseMinutes(current.start) : 570}
                sessions={ordered}
                highlightedRoom={current?.room ?? null}
                usedRooms={usedRooms}
                layers={layers}
                routeItems={ordered}
                onRoomSelect={() => undefined}
              />
              {avatarStyleFor("level1") && (
                <div className="routeMascot" style={avatarStyleFor("level1")}>
                  <PixelMascot compact avatar={avatar} />
                </div>
              )}
            </div>
          </div>
          <div className="routeDetails">
            <p className="stopBadge">Stop {ordered.length ? step + 1 : 0} of {ordered.length}</p>
            <h3>{current?.title.replace("Seed demo: ", "") ?? "No sessions selected"}</h3>
            <p>{current ? `${current.start}-${current.end} | ${current.room}` : "Add sessions before walking your day."}</p>
            <p>{next ? `Next walk estimate: ${estimateWalkMinutes(current, next)} minutes to ${next.room}.` : "Last selected stop."}</p>
            {!currentShape && <p>Offsite or unmapped items move to the travel marker.</p>}
            <div className="segmented" aria-label="Route speed">
              {[
                ["Slow", 0.65],
                ["Normal", 1],
                ["Fast", 1.6],
              ].map(([label, value]) => (
                <button key={label as string} className={speed === value ? "activeSegment" : ""} onClick={() => setSpeed(value as number)}>
                  {label as string}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [showIntro, setShowIntro] = useState(() => !new URLSearchParams(window.location.search).has("planner"));
  const [selectedDate, setSelectedDate] = useState<DateScope>(defaultDateScope);
  const [selectedMinutes, setSelectedMinutes] = useState(10 * 60);
  const [query, setQuery] = useState("");
  const [program, setProgram] = useState("All");
  const [floor, setFloor] = useState("All");
  const [registrationType, setRegistrationType] = useState<RegistrationType>(readRegistrationType);
  const [tags, setTags] = useState<string[]>([]);
  const [liveOnly, setLiveOnly] = useState(false);
  const [planIds, setPlanIds] = useState<string[]>(() => readStorageArray("siggraphPixelPlanIds"));
  const [dropInIds, setDropInIds] = useState<string[]>(() => readStorageArray("siggraphPixelDropInIds"));
  const [attendedIds, setAttendedIds] = useState<Set<string>>(() => new Set(readStorageArray("siggraphPixelAttendedIds")));
  const [highlightedRoom, setHighlightedRoom] = useState<string | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<ScheduleItem | null>(null);
  const [showPosters, setShowPosters] = useState(false);
  const [avatar, setAvatar] = useState<AvatarConfig>(() => readStorage("siggraphPixelAvatar", defaultAvatar));
  const [mapLayers, setMapLayers] = useState<MapLayers>({ restrooms: true, food: true, vertical: false, route: true });
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanel>("map");
  const plannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.localStorage.setItem("siggraphPixelPlanIds", JSON.stringify(planIds));
  }, [planIds]);

  useEffect(() => {
    window.localStorage.setItem("siggraphPixelDropInIds", JSON.stringify(dropInIds));
  }, [dropInIds]);

  useEffect(() => {
    window.localStorage.setItem("siggraphPixelAttendedIds", JSON.stringify([...attendedIds]));
  }, [attendedIds]);

  useEffect(() => {
    window.localStorage.setItem("siggraphPixelAvatar", JSON.stringify(avatar));
  }, [avatar]);

  useEffect(() => {
    window.localStorage.setItem("siggraphPixelRegistrationType", registrationType);
  }, [registrationType]);

  useEffect(() => {
    if (program !== "All" && !canAccessProgram(registrationType, program)) setProgram("All");
  }, [program, registrationType]);

  const selectedItems = useMemo(
    () => sortByTime(scheduleItems.filter((item) => planIds.includes(item.id) && canAccessProgram(registrationType, item.program))),
    [planIds, registrationType],
  );
  const selectedDropIns = useMemo(
    () => stickyDropIns.filter((item) => dropInIds.includes(item.id)),
    [dropInIds],
  );
  const filtered = useMemo(
    () =>
      filterSessions(scheduleItems, {
        selectedDate,
        query,
        program,
        floor,
        tags,
        liveOnly,
        selectedMinutes,
        registrationType,
      }),
    [selectedDate, query, program, floor, tags, liveOnly, selectedMinutes, registrationType],
  );
  const scopedSelectedItems = useMemo(
    () => (selectedDate === "all" ? selectedItems : selectedItems.filter((item) => item.date === selectedDate)),
    [selectedDate, selectedItems],
  );
  const daySessions = (selectedDate === "all" ? scheduleItems : scheduleItems.filter((item) => item.date === selectedDate)).filter(
    (item) => canAccessProgram(registrationType, item.program),
  );
  const activeRooms = daySessions.filter((item) => isActiveAt(item, selectedMinutes));
  const activeByRoom = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    scheduleItems
      .filter(
        (item) =>
          (selectedDate === "all" || item.date === selectedDate) &&
          canAccessProgram(registrationType, item.program) &&
          isActiveAt(item, selectedMinutes),
      )
      .forEach((item) => map.set(item.room, [...(map.get(item.room) ?? []), item]));
    return map;
  }, [selectedDate, selectedMinutes, registrationType]);
  const dayRouteRooms = useMemo(
    () =>
      sortByTime(scopedSelectedItems.filter((item) => item.floor !== "offsite")).map(
        (item) => item.room,
      ),
    [scopedSelectedItems],
  );
  const nextPlanned = scopedSelectedItems.find((item) => parseMinutes(item.start) >= selectedMinutes);
  const usedRooms = new Set([
    ...scheduleItems.filter((item) => canAccessProgram(registrationType, item.program)).map((item) => item.room),
    ...stickyDropIns.map((item) => item.room),
  ]);
  const posterItems = scheduleItems.filter((item) => canAccessProgram(registrationType, item.program) && /poster/i.test(`${item.program} ${item.title}`));

  const togglePlan = (id: string) => {
    setPlanIds((current) => (current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]));
  };
  const toggleTag = (tag: string) => {
    setTags((current) => (current.includes(tag) ? current.filter((candidate) => candidate !== tag) : [...current, tag]));
  };
  const toggleAttended = (id: string) => {
    setAttendedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleDropIn = (id: string) => {
    setDropInIds((current) => (current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]));
  };
  const handleRoomSelect = (roomId: string) => {
    setHighlightedRoom(roomId);
    const target = filtered.find((item) => item.room === roomId) ?? scheduleItems.find((item) => item.room === roomId);
    if (target) document.getElementById(`session-${target.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (showIntro) {
    return (
      <Welcome
        avatar={avatar}
        onRegistrationChange={setRegistrationType}
        onStart={() => {
          setShowIntro(false);
          window.scrollTo({ top: 0, behavior: "instant" });
        }}
      />
    );
  }

  return (
    <>
      <main className="appShell" ref={plannerRef}>
        <section className="plannerMasthead">
          <div>
            <h1>SIGGRAPH Pixel Planner</h1>
            <p>Plan your SIGGRAPH day, preview the LACC route, track what you attend, and turn it into a recap.</p>
          </div>
        </section>
        <div className="notice">{dataNotice}</div>
        <section className="controlBar" aria-label="Planner controls">
          <div className="dayTabs" role="tablist" aria-label="Conference days">
            {conferenceTabs.map((day) => (
              <button
                key={day.date}
                className={selectedDate === day.date ? "activeTab" : ""}
                onClick={() => setSelectedDate(day.date)}
              >
                {day.short}
                <span>{day.date === "all" ? "All days" : day.date.slice(5).replace("-", "/")}</span>
              </button>
            ))}
          </div>
          <label className="timeControl">
            <Clock size={16} />
            <span>{formatMinutes(selectedMinutes)}</span>
            <input
              type="range"
              min={8 * 60}
              max={19 * 60}
              step={15}
              value={selectedMinutes}
              onChange={(event) => setSelectedMinutes(Number(event.target.value))}
            />
          </label>
          <div className="activeNow">
            <strong>{activeRooms.length}</strong> active mapped rooms
          </div>
          <label className="registrationControl">
            <span>Registration</span>
            <select
              value={registrationType}
              onChange={(event) => setRegistrationType(event.target.value as RegistrationType)}
              aria-label="Registration type"
            >
              {registrationOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <nav className="mobileModeTabs" aria-label="Planner sections">
          {mobilePanels.map(({ id, label, detail, icon: Icon }) => (
            <button
              key={id}
              className={activeMobilePanel === id ? "activeMobileMode" : ""}
              onClick={() => setActiveMobilePanel(id)}
              aria-pressed={activeMobilePanel === id}
              aria-label={`${label}: ${detail}`}
            >
              <Icon size={16} />
              <span>{label}</span>
              <small>{detail}</small>
            </button>
          ))}
        </nav>

        <div className="plannerGrid">
          <div className="mainColumn">
            <div className={`mobilePane mobilePaneMap ${activeMobilePanel === "map" ? "activeMobilePane" : ""}`}>
              <section className="mapLayerBar" aria-label="Map navigation layers">
                {[
                  ["restrooms", "Restrooms"],
                  ["food", "Food"],
                  ["vertical", "Stairs / elevators"],
                  ["route", "Indoor route"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={mapLayers[key as keyof MapLayers] ? "activeLayer" : ""}
                    onClick={() => setMapLayers((current) => ({ ...current, [key]: !current[key as keyof MapLayers] }))}
                  >
                    {key === "food" ? <Coffee size={15} /> : key === "route" ? <Route size={15} /> : <MapPin size={15} />}
                    {label}
                  </button>
                ))}
              </section>

              <VenueMap3D
                sessionsByRoom={activeByRoom}
                highlightedRoom={highlightedRoom}
                usedRooms={usedRooms}
                routeRooms={dayRouteRooms}
                showRoute={mapLayers.route}
                layers={mapLayers}
                onRoomSelect={handleRoomSelect}
              />
            </div>

            <div className={`mobilePane mobilePaneSessions ${activeMobilePanel === "sessions" ? "activeMobilePane" : ""}`}>
              <section className="filters">
                <label className="searchBox">
                  <Search size={17} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search selected day" />
                </label>
                <select value={program} onChange={(event) => setProgram(event.target.value)} aria-label="Program filter">
                  {programs.filter((item) => item === "All" || canAccessProgram(registrationType, item)).map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <select value={floor} onChange={(event) => setFloor(event.target.value)} aria-label="Location filter">
                  {floors.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <label className="toggle">
                  <input type="checkbox" checked={liveOnly} onChange={(event) => setLiveOnly(event.target.checked)} />
                  Live at selected time
                </label>
              </section>

              <section className="organizerStrip" aria-label="Day organizer">
                <div>
                  <strong>{scopedSelectedItems.length}</strong>
                  <span>{selectedDate === "all" ? "planned total" : "planned this day"}</span>
                </div>
                <div>
                  <strong>{filtered.length}</strong>
                  <span>{liveOnly ? "live matches" : selectedDate === "all" ? "all matches" : "day matches"}</span>
                </div>
                <div>
                  <strong>{nextPlanned?.start ?? "--"}</strong>
                  <span>{nextPlanned ? `next: ${nextPlanned.title.replace("Seed demo: ", "").slice(0, 48)}` : "no upcoming planned session"}</span>
                </div>
              </section>
              <p className="accessNote">
                Showing {registrationOptions.find((item) => item.value === registrationType)?.label} access. Confirm exact eligibility with SIGGRAPH before publishing externally.
              </p>

              <details className="sessionBlock chipsBlock">
                <summary>
                  Interest filters <span className="blockCount">{tags.length ? `${tags.length} active` : allTags.length}</span>
                </summary>
                <section className="chips" aria-label="Interest filters">
                  {allTags.map((tag) => (
                    <button key={tag} className={tags.includes(tag) ? "chip activeChip" : "chip"} onClick={() => toggleTag(tag)}>
                      {tag}
                    </button>
                  ))}
                </section>
              </details>

              <DropInNote selectedDropInIds={dropInIds} onToggleDropIn={toggleDropIn} onPosters={() => setShowPosters(true)} />

              <section className="sessions" aria-label="Schedule sessions">
                <SessionGroups
                  items={filtered}
                  planIds={planIds}
                  attendedIds={attendedIds}
                  onTogglePlan={togglePlan}
                  onToggleAttended={toggleAttended}
                  onHover={setHighlightedRoom}
                  onDetails={setSelectedDetail}
                />
                {!filtered.length && <p className="noResults">No sessions match those filters for this selected day.</p>}
              </section>
            </div>
          </div>

          <PlanPanel
            selectedItems={scopedSelectedItems}
            selectedDropIns={selectedDropIns}
            attendedIds={attendedIds}
            onRemove={(id) => setPlanIds((current) => current.filter((candidate) => candidate !== id))}
            onToggleAttended={toggleAttended}
            onWalk={() => setShowRoute(true)}
            avatar={avatar}
            onAvatarChange={setAvatar}
            mobilePanel={activeMobilePanel}
          />
        </div>
      </main>
      <footer>
        <CalendarDays size={16} /> Designed and built by <a href="https://jayasrisng.com" target="_blank" rel="noreferrer">Jayasri</a>
      </footer>
      {showRoute && <RouteModal items={scopedSelectedItems} usedRooms={usedRooms} avatar={avatar} layers={mapLayers} onClose={() => setShowRoute(false)} />}
      {selectedDetail && <SessionDetailModal item={selectedDetail} onClose={() => setSelectedDetail(null)} />}
      {showPosters && <PosterModal posterItems={posterItems} onClose={() => setShowPosters(false)} />}
    </>
  );
}

const rootElement = document.getElementById("root")!;
const rootWindow = window as Window & { __siggraphPixelRoot?: ReturnType<typeof createRoot> };
const root = rootWindow.__siggraphPixelRoot ?? createRoot(rootElement);
rootWindow.__siggraphPixelRoot = root;

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
