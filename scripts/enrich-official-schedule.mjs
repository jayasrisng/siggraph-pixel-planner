import fs from "node:fs/promises";

const DATA_PATH = new URL("../src/data/officialSchedule.json", import.meta.url);
const rows = JSON.parse(await fs.readFile(DATA_PATH, "utf8"));

const decode = (value) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&ndash;|&mdash;/g, "-")
    .replace(/&copy;/g, "©")
    .replace(/&hellip;/g, "...")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractDescription = (html, title) => {
  const text = decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " "),
  );
  const titleIndex = text.indexOf(title);
  const start = text.indexOf("Description", Math.max(0, titleIndex));
  if (start < 0) return "";
  const after = text.slice(start + "Description".length);
  const endMarkers = [
    " Lecturers ", " Lecturer ", " Speakers ", " Speaker ", " Contributors ",
    " Organizer ", " Organizers ", " Presenter ",
    // Page footer / metadata blocks that should never end up in a description:
    " Event Type ", " © 2026 SIGGRAPH", " All rights reserved",
  ];
  const end = endMarkers
    .map((marker) => after.indexOf(marker))
    .filter((index) => index > 80)
    .sort((a, b) => a - b)[0];
  const description = (end ? after.slice(0, end) : after.slice(0, 900)).trim();
  if (description.length < 30 || description.startsWith("SIGGRAPH 2026")) return "";
  return description.slice(0, 1200);
};

const fetchDetail = async (item) => {
  const response = await fetch(item.programPage ?? item.sourceUrl);
  if (!response.ok) throw new Error(`${response.status} ${item.title}`);
  const html = await response.text();
  const description = extractDescription(html, item.title);
  return description ? { ...item, description, agenda: [description] } : item;
};

const concurrency = 8;
let cursor = 0;
let completed = 0;
const enriched = new Array(rows.length);

const worker = async () => {
  while (cursor < rows.length) {
    const index = cursor;
    cursor += 1;
    try {
      enriched[index] = await fetchDetail(rows[index]);
    } catch {
      enriched[index] = rows[index];
    }
    completed += 1;
    if (completed % 100 === 0) console.log(`enriched ${completed}/${rows.length}`);
  }
};

await Promise.all(Array.from({ length: concurrency }, worker));
await fs.writeFile(DATA_PATH, `${JSON.stringify(enriched, null, 2)}\n`);
console.log(`wrote ${enriched.length} rows`);
