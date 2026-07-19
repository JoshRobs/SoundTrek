/**
 * Cleans YouTube playlist video titles down to bare track names, e.g.
 *   `The Last of Us: DLC-The Left Behind Soundtrack:"Apprehension" (HQ)`
 *     → `Apprehension`
 *   `Dino Crisis Ost 5 - An Encounter`  → `An Encounter`
 *   `Flow - Flow theme`                 → `Flow theme`
 *   `Flow - Flow`                       → `Flow`
 *
 * Strategy: split the title into separator-delimited segments, then drop
 * whole segments that are just the game title, composer, studio, or noise
 * ("Official Soundtrack", "OST", "HQ", …). Words inside a surviving segment
 * are never edited (so a track legitimately named after the game survives),
 * with one exception: a leading "GameName OST 07"-style preamble glued to
 * the name without a separator. If every segment gets dropped (e.g.
 * "Flow - Flow"), fall back to the last game-matching segment. Matching is
 * fuzzy (Levenshtein) because uploader titles contain typos ("Soundtack",
 * "Withing").
 *
 * Shared by scripts/sync-tracklists.ts, scripts/trim-track-titles.ts, and
 * the live-fetch fallback in SoundtrackView.
 */

export interface TrackTitleContext {
  gameTitle: string;
  composers?: string[];
  studio?: string;
  /** 1-based playlist index; lets "17 One Eyed Slugger" shed its number. */
  trackNumber?: number;
}

const STOPWORDS = new Set(["the", "a", "an", "of", "and", "de", "la", "le"]);

// Tokens that never carry track-name meaning on their own. Used only to
// decide whether a whole segment/bracket is droppable — never removed from
// a surviving title. Deliberately excludes words like "theme" and "song"
// ("Flow theme" must survive as-is).
const NOISE_TOKENS = new Set([
  "official", "original", "full", "complete", "entire", "video", "game",
  "games", "videogame", "soundtrack", "soundtracks", "ost", "osts", "score",
  "album", "music", "bgm", "gamerip", "rip", "vgm", "audio", "playlist",
  "extended", "version", "remastered", "remaster", "hq", "hd", "4k", "8k",
  "uhd", "flac", "mp3", "kbps", "khz", "fps", "stereo", "lyrics", "lyric",
  "w", "with", "by", "composed", "performed", "feat", "ft", "featuring",
  "cd", "disc", "vol", "volume", "track", "dlc", "edition", "deluxe",
  "definitive", "goty", "unreleased",
]);

const LONG_NOISE = [...NOISE_TOKENS].filter((n) => n.length >= 6);

const ROMAN: Record<string, string> = {
  i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8",
  ix: "9", x: "10", xi: "11", xii: "12", xiii: "13", xiv: "14", xv: "15",
  xvi: "16",
};

// Bracketed groups that are pure noise, matched against the folded content.
const BRACKET_NOISE_RE =
  /^(?:hq|hd|4k|8k|high quality|full|loops?|looped|extended(?: version| edit)?|remaster(?:ed)?|official(?: audio| video| soundtrack| music video)?|audio(?: only)?|video|music video|lyrics?|(?:w|with) lyrics|no commentary|gamerip|game rip|complete|full (?:album|ost|soundtrack)|from .+|feat\.? .+|ft\.? .+)$/;

// ── Text helpers ───────────────────────────────────────────────────────────

function normalize(raw: string): string {
  return raw
    .replace(/[“”„«»「」『』]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒⁃−]/g, "-")
    .replace(/\bO\.?\s?S\.?\s?T\.?(?=[\s"'):\]|,]|$)/gi, "OST")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lowercase, de-accent, strip punctuation. */
function foldBase(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['ʼ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** foldBase + roman→arabic numerals, so "VII" and "7" compare equal. */
function fold(s: string): string {
  return foldBase(s)
    .split(" ")
    .map((t) => ROMAN[t] ?? t)
    .join(" ");
}

function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

function isNoiseToken(t: string): boolean {
  if (NOISE_TOKENS.has(t)) return true;
  // Fuzzy: catches uploader typos like "soundtack", "soundtracl".
  if (t.length >= 6) {
    for (const n of LONG_NOISE) {
      if (Math.abs(n.length - t.length) <= 1 && levenshtein(t, n, 1) <= 1) {
        return true;
      }
    }
  }
  return false;
}

/** The "meaningful residue" of a phrase: folded, minus stopwords/noise/numbers. */
function keyTokens(s: string): string[] {
  return fold(s)
    .split(" ")
    .filter(
      (t) => t && !STOPWORDS.has(t) && !isNoiseToken(t) && !/^\d+$/.test(t),
    );
}

function key(s: string): string {
  return keyTokens(s).join(" ");
}

function fuzzyEq(a: string, b: string): boolean {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  const max = Math.max(a.length, b.length);
  if (min < 8) return false;
  const tol = Math.max(1, Math.min(2, Math.floor(max / 8)));
  return levenshtein(a, b, tol) <= tol;
}

function fuzzyIn(k: string, keys: string[]): boolean {
  return k !== "" && keys.some((g) => fuzzyEq(k, g));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Context compilation ────────────────────────────────────────────────────

interface Compiled {
  /** Folded strings whose presence marks text as game-referencing. */
  gameFolds: string[];
  otherFolds: string[]; // composers + studio
  gameKeys: string[];
  gameKeySeqs: string[][]; // for subsequence-with-tiny-residue drops
  composerKeys: string[];
  studioKeys: string[];
  /** Strips a "GameName OST 07"-style preamble glued to a segment. */
  prefixRe: RegExp | null;
}

function compile(ctx: TrackTitleContext): Compiled {
  const gameFolds = new Set<string>();
  const gameKeys = new Set<string>();
  const variantWords: string[][] = []; // for prefixRe, in raw-ish token form

  const addGame = (s: string) => {
    for (const f of [foldBase(s), fold(s)]) {
      if (f.length < 3) continue;
      gameFolds.add(f);
      variantWords.push(f.split(" "));
      // Acronym ("Final Fantasy XII" → ffxii/ff12) — droppability only.
      // Numerals (arabic or roman) stay whole.
      const words = f.split(" ").filter((w) => !STOPWORDS.has(w));
      if (words.length >= 2) {
        const ac = words
          .map((w) => (/^\d+$/.test(w) || ROMAN[w] ? w : w[0]))
          .join("");
        if (ac.length >= 3) gameKeys.add(ac);
      }
    }
    const k = key(s);
    if (k.length >= 3) gameKeys.add(k);
  };

  addGame(ctx.gameTitle);
  const full = fold(ctx.gameTitle);
  if (full.startsWith("the ") && full.length >= 8) {
    addGame(full.slice(4));
  }
  // Title/subtitle halves: "Total War: Warhammer" → uploaders often use only
  // one. Split on colons/parens only — hyphens are part of compound names
  // ("Counter-Strike", "Half-Life").
  for (const part of ctx.gameTitle.split(/[:(]/)) {
    if (foldBase(part).length >= 4) addGame(part);
  }

  const otherFolds = new Set<string>();
  const composerKeys = new Set<string>();
  for (const c of ctx.composers ?? []) {
    const f = fold(c);
    if (f.length >= 4) otherFolds.add(f);
    const k = key(c);
    if (k.length >= 4) composerKeys.add(k);
    const last = f.split(" ").at(-1) ?? "";
    if (last.length >= 4) composerKeys.add(last);
  }

  const studioKeys = new Set<string>();
  if (ctx.studio) {
    const f = fold(ctx.studio);
    if (f.length >= 4) otherFolds.add(f);
    const k = key(ctx.studio);
    if (k.length >= 4) studioKeys.add(k);
  }

  // Variant words are folded (alphanumeric), but the raw text may contain
  // apostrophes/periods inside them ("Assassin's", "Bros.") — allow those
  // between any two characters.
  const wordPattern = (w: string) =>
    w.split("").map(escapeRe).join("['.]?");
  const variantAlt = variantWords
    .map((words) => words.map(wordPattern).join("[\\W_]+"))
    .join("|");
  const noiseAlt = [...NOISE_TOKENS].map(escapeRe).join("|");
  const prefixRe = variantAlt
    ? new RegExp(
        `^["'\\s]*(?:${variantAlt})(?:[\\W_]+(?:${noiseAlt}|\\d{1,3}))+[\\W_]+`,
        "i",
      )
    : null;

  return {
    gameFolds: [...gameFolds],
    otherFolds: [...otherFolds],
    gameKeys: [...gameKeys],
    gameKeySeqs: [...gameKeys]
      .map((k) => k.split(" "))
      .filter((seq) => seq.join("").length >= 4),
    composerKeys: [...composerKeys],
    studioKeys: [...studioKeys],
    prefixRe,
  };
}

function containsAny(text: string, folds: string[]): boolean {
  const f = ` ${fold(text)} `;
  const fb = ` ${foldBase(text)} `;
  return folds.some((v) => f.includes(` ${v} `) || fb.includes(` ${v} `));
}

/** Does this text mention the game at all (even inside a longer phrase)? */
function referencesGame(text: string, c: Compiled): boolean {
  if (containsAny(text, c.gameFolds)) return true;
  const k = ` ${key(text)} `;
  // Multi-word keys only: single words ("flow") would over-trigger.
  return c.gameKeys.some((g) => g.includes(" ") && k.includes(` ${g} `));
}

/**
 * True when the segment is the game name plus at most a couple of tiny junk
 * tokens ("The Return of the King CR"). Residue tokens must be short so real
 * names that merely contain the game ("Welcome, Fruit Ninja") survive.
 */
function isGameWithTinyResidue(kToks: string[], c: Compiled): boolean {
  for (const seq of c.gameKeySeqs) {
    outer: for (let i = 0; i + seq.length <= kToks.length; i++) {
      for (let j = 0; j < seq.length; j++) {
        if (kToks[i + j] !== seq[j]) continue outer;
      }
      const residue = kToks.length - seq.length;
      if (
        residue <= 2 &&
        [...kToks.slice(0, i), ...kToks.slice(i + seq.length)].every(
          (t) => t.length <= 3,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

// ── Pipeline steps ─────────────────────────────────────────────────────────

/** Remove (...) / [...] groups that are pure noise or game/composer refs. */
function stripNoiseBrackets(title: string, c: Compiled): string {
  let prev = "";
  while (prev !== title) {
    prev = title;
    title = title
      .replace(/[(\[{]([^()\[\]{}]*)[)\]}]/g, (m, content: string) => {
        if (
          BRACKET_NOISE_RE.test(fold(content)) ||
          key(content) === "" ||
          referencesGame(content, c) ||
          containsAny(content, c.otherFolds)
        ) {
          return " ";
        }
        return m;
      })
      .replace(/\s+/g, " ")
      .trim();
  }
  return title;
}

/**
 * `Game Soundtrack: "Apprehension"` → `Apprehension`. Only fires when the
 * text outside the quotes is game/composer/noise, and never treats a quoted
 * game reference (`from "The Last of Us Part I"`) as the track name.
 */
function extractQuoted(title: string, c: Compiled): string {
  const groups: string[] = [];
  const re = /"([^"]{2,})"|(?:^|[\s:\-–—(,])'([^']{2,})'(?=[\s)\-–—,.!?]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(title))) groups.push(m[1] ?? m[2]);
  if (!groups.length) return title;

  const real = groups.filter((g) => !referencesGame(g, c));
  if (!real.length) return title;

  let outside = title;
  for (const g of groups) outside = outside.replace(g, " ");
  outside = outside.replace(/["']/g, " ");
  if (
    key(outside) === "" ||
    referencesGame(outside, c) ||
    containsAny(outside, c.otherFolds)
  ) {
    return real.join(" - ");
  }
  return title;
}

const SEGMENT_SPLIT_RE = /\s+[-–—]+\s+|\s*\|\s*|\s+[•·~]+\s+|:\s+|\s+\/\s+/;

const NUM_PREFIX_RES = [
  /^(?:track|no\.?|#)\s*\d{1,3}\s*[.:)\]\-–—]?\s*/i,
  /^\d{1,3}\s*[.:)\]]\s*/,
  /^\d{1,3}\s+[-–—]\s*/,
  /^0\d{1,2}(?:\s*\/\s*\d{1,3})?\s+/,
];

// After a bare "17 " prefix, these words mean the number was part of the
// name ("7 PM", "24 Hours"), not a track index.
const NUM_UNIT_RE =
  /^(?:am|pm|a\.m|p\.m|o'?clock|hours?|minutes?|seconds?|days?|years?|st|nd|rd|th)\b/i;

function cleanSegment(
  seg: string,
  c: Compiled,
  trackNumber: number | undefined,
): string {
  seg = seg.trim();
  // Unwrap quotes enclosing the entire segment.
  const wrapped = seg.match(/^["'](.+)["']$/);
  if (wrapped) seg = wrapped[1].trim();
  // Leading track numbers ("04.", "Track 12 -", "01 ") — but only with a
  // separator or leading zero, so titles like "7 Days" survive.
  for (const re of NUM_PREFIX_RES) {
    const stripped = seg.replace(re, "");
    if (
      stripped !== seg &&
      stripped.trim().length >= 2 &&
      !NUM_UNIT_RE.test(stripped.trim())
    ) {
      seg = stripped.trim();
      break;
    }
  }
  // Bare number with no separator ("17 One Eyed Slugger") — only when it
  // matches this row's actual playlist position.
  if (trackNumber != null) {
    const m = seg.match(/^(\d{1,3})\s+(?=\S)/);
    if (
      m &&
      parseInt(m[1]) === trackNumber &&
      !NUM_UNIT_RE.test(seg.slice(m[0].length)) &&
      seg.length - m[0].length >= 2
    ) {
      seg = seg.slice(m[0].length).trim();
    }
  }
  // "FFXII OST Stilshrine of Miriam"-style preamble glued to the name.
  if (c.prefixRe) {
    const stripped = seg.replace(c.prefixRe, "");
    if (stripped !== seg && stripped.trim().length >= 3) {
      seg = stripped.trim();
    }
  }
  // `Zin Battle by Malcolm Kirby Jr.` → `Zin Battle`, only when the tail is
  // actually a known composer.
  const by = seg.match(/^(.+?)\s+by\s+(.+)$/i);
  if (
    by &&
    by[1].trim().length >= 2 &&
    fuzzyIn(key(by[2]), c.composerKeys)
  ) {
    seg = by[1].trim();
  }
  // `The Path, from "The Last of Us Part I" Soundtrack` → `The Path`, only
  // when the tail actually references the game or an album.
  const from = seg.match(/^(.*?),?\s+(?:from|de)\s+(.+)$/i);
  if (
    from &&
    from[1].trim().length >= 2 &&
    (referencesGame(from[2], c) ||
      /(^|\s)(soundtrack|ost|album|score)(\s|$)/.test(fold(from[2])))
  ) {
    seg = from[1].trim();
  }
  return seg.trim();
}

function tidy(s: string): string {
  return s
    .replace(/^[\s\-–—:|,]+/, "")
    .replace(/[\s\-–—:|,]+$/, "")
    .replace(/\s+\.+$/, "")
    .replace(/^["'](.+)["']$/, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Entry point ────────────────────────────────────────────────────────────

export function cleanTrackTitle(raw: string, ctx: TrackTitleContext): string {
  const c = compile(ctx);
  const normalized = normalize(raw);

  let title = stripNoiseBrackets(normalized, c);
  title = extractQuoted(title, c);

  const segments = title
    .split(SEGMENT_SPLIT_RE)
    .map((s) => cleanSegment(s, c, ctx.trackNumber))
    .filter((s) => s.length > 0);

  const kept: string[] = [];
  let lastGame = "";
  let lastComposer = "";
  for (const seg of segments) {
    const kToks = keyTokens(seg);
    const k = kToks.join(" ");
    if (fuzzyIn(k, c.gameKeys) || isGameWithTinyResidue(kToks, c)) {
      lastGame = seg;
    } else if (fuzzyIn(k, c.composerKeys)) {
      lastComposer = seg;
    } else if (k === "" || fuzzyIn(k, c.studioKeys)) {
      // pure noise / studio credit — drop silently
    } else {
      kept.push(seg);
    }
  }

  // Everything matched the game/composer ("Flow - Flow"): the track really
  // is named after the game — keep the last such segment, shedding trailing
  // noise words ("Banished Soundtrack" → "Banished").
  let fallback = lastGame || lastComposer;
  for (
    let words = fallback.split(" ");
    words.length > 1 && isNoiseToken(fold(words.at(-1) ?? ""));
    words = fallback.split(" ")
  ) {
    fallback = words.slice(0, -1).join(" ");
  }
  const result = tidy(kept.length ? kept.join(" - ") : fallback);
  return result || tidy(normalized) || raw.trim();
}

// ── Playlist-level majority conventions ────────────────────────────────────
//
// Per-title cleaning can't touch "Crysis Warhead Hero Theme" — a game name
// followed directly by meaningful words is indistinguishable from a track
// genuinely named after the game. But when ≥80% of a playlist shares the
// exact same affix, that *is* proof of an uploader convention, whatever the
// words are — so it's stripped. Shared whole segments and shared leading
// words go content-agnostically; shared *trailing* words are only stripped
// when they're noise or game/composer references, so a soundtrack where
// most tracks legitimately end in "Theme" or "(Remix)" keeps them.

export interface TracklistTitleInput {
  title: string;
  unavailable?: boolean;
}

const MIN_QUORUM_TRACKS = 4;

function quorumThreshold(n: number): number {
  return Math.max(3, Math.ceil(n * 0.8));
}

function topEntry(counts: Map<string, number>): [string, number] {
  let top = "";
  let topN = 0;
  for (const [f, n] of counts) {
    if (n > topN) {
      top = f;
      topN = n;
    }
  }
  return [top, topN];
}

/** Drop a first/last segment shared verbatim by ≥80% of the playlist. */
function dropMajoritySegments(
  titles: string[],
  idxs: number[],
  side: "first" | "last",
): boolean {
  const th = quorumThreshold(idxs.length);
  const counts = new Map<string, number>();
  for (const i of idxs) {
    const segs = titles[i].split(SEGMENT_SPLIT_RE).filter(Boolean);
    const seg = side === "first" ? segs[0] : segs.at(-1);
    const f = seg ? fold(seg) : "";
    if (f) counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  const [top, topN] = topEntry(counts);
  if (!top || topN < th) return false;

  let changed = false;
  for (const i of idxs) {
    const segs = titles[i].split(SEGMENT_SPLIT_RE).filter(Boolean);
    // A title that *is* the shared segment stays — never empty a title.
    if (segs.length < 2) continue;
    const pos = side === "first" ? 0 : segs.length - 1;
    if (fold(segs[pos]) === top) {
      segs.splice(pos, 1);
      const joined = tidy(segs.join(" - "));
      if (joined && joined !== titles[i]) {
        titles[i] = joined;
        changed = true;
      }
    }
  }
  return changed;
}

/** Whitespace tokens paired with their folded comparison unit. */
function unitsOf(tokens: string[]): { f: string; ti: number }[] {
  const out: { f: string; ti: number }[] = [];
  tokens.forEach((t, ti) => {
    const f = foldBase(t);
    if (f) out.push({ f, ti });
  });
  return out;
}

/**
 * Strip the longest run of leading/trailing words shared by ≥80% of the
 * playlist ("Crysis Warhead Mine Fight Theme" → "Mine Fight Theme"; every
 * title ending in "Audio" → dropped).
 */
function stripMajorityWords(
  titles: string[],
  idxs: number[],
  side: "prefix" | "suffix",
  c: Compiled,
): boolean {
  const th = quorumThreshold(idxs.length);
  const per = idxs.map((i) => {
    const tokens = titles[i].split(/\s+/);
    return { i, tokens, units: unitsOf(tokens) };
  });
  const unitAt = (p: (typeof per)[0], k: number) =>
    side === "prefix" ? p.units[k] : p.units[p.units.length - 1 - k];

  const counts = new Map<string, number>();
  for (const p of per) {
    const u = unitAt(p, 0);
    if (u) counts.set(u.f, (counts.get(u.f) ?? 0) + 1);
  }
  const [top, topN] = topEntry(counts);
  if (!top || topN < th) return false;

  // Greedily extend the shared run while it still clears the quorum.
  let matching = per.filter((p) => unitAt(p, 0)?.f === top);
  let len = 1;
  for (;;) {
    const next = new Map<string, number>();
    for (const p of matching) {
      const u = unitAt(p, len);
      if (u) next.set(u.f, (next.get(u.f) ?? 0) + 1);
    }
    const [nTop, nN] = topEntry(next);
    if (!nTop || nN < th) break;
    matching = matching.filter((p) => unitAt(p, len)?.f === nTop);
    len++;
  }

  const sample = matching[0];
  const affixUnits = Array.from(
    { length: len },
    (_, k) => unitAt(sample, k).f,
  );
  const affixStr = (side === "prefix" ? affixUnits : [...affixUnits].reverse())
    .join(" ");

  // A lone stopword/determiner ("The …", "All …") is not a convention.
  if (
    len === 1 &&
    (STOPWORDS.has(affixStr) || affixStr === "all" || affixStr.length < 2)
  ) {
    return false;
  }
  // Trailing words must be provably meaningless before we take them.
  if (side === "suffix") {
    const safe =
      affixStr
        .split(" ")
        .every(
          (w) => STOPWORDS.has(w) || isNoiseToken(w) || /^\d+$/.test(w),
        ) ||
      referencesGame(affixStr, c) ||
      containsAny(affixStr, c.otherFolds);
    if (!safe) return false;
  }

  let changed = false;
  for (const p of matching) {
    // A title that *is* the affix stays — never empty a title.
    if (p.units.length <= len) continue;
    // Keep a prefix that contextualizes a number ("Season 5" → not "5").
    if (side === "prefix" && /^\d/.test(unitAt(p, len)?.f ?? "")) continue;
    const edge = unitAt(p, len - 1);
    const newTokens =
      side === "prefix"
        ? p.tokens.slice(edge.ti + 1)
        : p.tokens.slice(0, edge.ti);
    const t = tidy(newTokens.join(" "));
    if (t && t !== titles[p.i]) {
      titles[p.i] = t;
      changed = true;
    }
  }
  return changed;
}

/**
 * Clean a whole playlist's titles: per-title cleaning first, then the
 * majority-convention passes. Idempotent. Unavailable rows pass through
 * untouched and don't count toward quorums.
 */
export function cleanTracklistTitles(
  items: TracklistTitleInput[],
  ctx: TrackTitleContext,
): string[] {
  const titles = items.map((it, i) =>
    it.unavailable
      ? it.title
      : cleanTrackTitle(it.title, { ...ctx, trackNumber: i + 1 }),
  );
  const idxs = items
    .map((_, i) => i)
    .filter((i) => !items[i].unavailable);
  if (idxs.length < MIN_QUORUM_TRACKS) return titles;

  const c = compile(ctx);
  // Removing one affix can expose another ("Game OST - X | Channel"), so
  // loop to a fixed point; bounded to keep pathological playlists cheap.
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    changed = dropMajoritySegments(titles, idxs, "first") || changed;
    changed = dropMajoritySegments(titles, idxs, "last") || changed;
    changed = stripMajorityWords(titles, idxs, "prefix", c) || changed;
    changed = stripMajorityWords(titles, idxs, "suffix", c) || changed;
    if (!changed) break;
  }
  return titles;
}
