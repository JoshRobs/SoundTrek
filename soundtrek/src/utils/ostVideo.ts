// Full-OST single-video matching, shared by scripts/enrich-video-ids.ts and the
// youtube-proxy worker's /youtube-search (admin "Add Soundtrack" import), so
// both pick exactly the same video for a game.
//
// Runtime-agnostic: each caller passes in its own youtubei.js (Innertube)
// search — the Node build in the script, the cf-worker build in the worker.
// Imported by the worker too — keep this file dependency-free.

export const MIN_DURATION = 20 * 60; // 20 minutes in seconds
export const MIN_SCORE = 4; // minimum score to accept a result
export const CONFIDENT = 7; // score above which no warning is shown

// ── Scoring ───────────────────────────────────────────────────────────────────

const BAD_KEYWORDS = [
  "cover", "covers", "remix", "remixed", "piano", "tribute",
  "arrangement", "arranged", "karaoke", "lofi", "lo-fi",
  "chiptune", "jazz", "8-bit", "8bit", "fan made", "fan-made",
  "loop", "walkthrough", "1 hour", "one hour", "extended",
  "menu theme", "lobby theme", "title screen",
];

const OST_KEYWORDS = [
  "original soundtrack", "original game soundtrack", "original score",
  "full ost", "complete ost", "full soundtrack", "complete soundtrack",
  "game music", "music from", " ost ",
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

// Roman numerals I–XXX — covers any realistic game series
const ROMAN_NUMERALS = new Set([
  "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x",
  "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx",
  "xxi", "xxii", "xxiii", "xxiv", "xxv", "xxvi", "xxvii", "xxviii", "xxix", "xxx",
]);

// Returns true if the video title contains the game title followed immediately
// by a series number (Arabic or Roman) that isn't already part of the game title.
// e.g. game="Forza Horizon",     video="Forza Horizon 6 OST"   → true  (reject)
//      game="Forza Horizon 5",   video="Forza Horizon 5 OST"   → false (accept)
//      game="Final Fantasy",     video="Final Fantasy VII OST" → true  (reject)
//      game="Final Fantasy VII", video="Final Fantasy VII OST" → false (accept)
function hasUnexpectedSeriesNumber(gt: string, vt: string): boolean {
  const idx = vt.indexOf(gt);
  if (idx === -1) return false;
  const after = vt.slice(idx + gt.length).trimStart();

  // Check Arabic numeral
  const arabicMatch = after.match(/^(\d+)/);
  if (arabicMatch) {
    const gameNumbers: string[] = gt.match(/\d+/g) ?? [];
    if (!gameNumbers.includes(arabicMatch[1])) return true;
  }

  // Check Roman numeral (next whitespace-delimited token)
  const romanMatch = after.match(/^([a-z]+)/);
  if (romanMatch && ROMAN_NUMERALS.has(romanMatch[1])) {
    const gameRomans = gt.split(" ").filter((w) => ROMAN_NUMERALS.has(w));
    if (!gameRomans.includes(romanMatch[1])) return true;
  }

  return false;
}

export function scoreVideo(videoTitle: string, gameTitle: string, durationSeconds: number): number {
  const vt = normalize(videoTitle);
  const gt = normalize(gameTitle);

  // Hard reject: too short, fake "exactly 1 hour" videos, or bad keywords
  if (durationSeconds < MIN_DURATION) return -1;
  if (Math.abs(durationSeconds - 3600) <= 2) return -1;
  if (BAD_KEYWORDS.some((b) => vt.includes(b))) return -1;

  let score = 0;

  // Game title must appear verbatim in the video title — hard reject otherwise
  if (vt === gt) score += 5;
  else if (vt.includes(gt)) score += 4;
  else return -1;

  // Reject if the video is for a different numbered entry in the series
  // e.g. game "Forza Horizon" must not match "Forza Horizon 6 OST"
  if (hasUnexpectedSeriesNumber(gt, vt)) return -1;

  // Must contain "soundtrack" or "ost" — hard reject otherwise
  if (!vt.includes("soundtrack") && !vt.includes(" ost") && !vt.includes("(ost)") && !vt.includes("[ost]")) return -1;

  // Bonus for more specific OST keywords
  if (OST_KEYWORDS.some((k) => vt.includes(k))) score += 3;
  else score += 1;

  // Bonus for hour+ videos — very likely a full OST
  if (durationSeconds >= 60 * 60) score += 1;

  return score;
}

// ── Search ────────────────────────────────────────────────────────────────────

// The fields read off each node of youtubei.js `(await yt.search(q, { type: "video" })).videos`.
// That feed is a union of node types (shorts, lockups…) that don't all carry
// these, so callers pass the raw nodes and missing fields just fail the checks.
interface SearchVideo {
  id?: string;
  title?: { text?: string };
  duration?: { seconds?: number };
}

export interface OstVideo {
  videoId: string;
  title: string;
  seconds: number;
  score: number;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function findOstVideo(
  search: (query: string) => Promise<readonly object[]>,
  gameTitle: string,
): Promise<OstVideo | null> {
  // Try multiple queries, take the best-scoring result across all of them
  const queries = [
    `${gameTitle} original soundtrack`,
    `${gameTitle} full OST`,
    `${gameTitle} complete soundtrack`,
  ];

  let best: OstVideo | null = null;

  for (const query of queries) {
    let videos: readonly object[];
    try {
      videos = await search(query);
    } catch {
      continue;
    }

    for (const v of videos as readonly SearchVideo[]) {
      if (!v.id || !v.title?.text) continue;
      const score = scoreVideo(v.title.text, gameTitle, v.duration?.seconds ?? 0);
      if (score < MIN_SCORE) continue;
      if (!best || score > best.score) {
        best = { videoId: v.id, title: v.title.text, seconds: v.duration?.seconds ?? 0, score };
      }
    }

    // Short-circuit if we have a confident result
    if (best && best.score >= CONFIDENT) break;

    await sleep(800);
  }

  return best;
}
