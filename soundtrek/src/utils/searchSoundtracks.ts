import type { Soundtrack } from "@/types/soundtrack";

// Accent- and case-insensitive, so "pokemon" finds "Pokémon".
export const normalizeTitle = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const likesOf = (s: Soundtrack) => s.total_likes ?? s.likes ?? 0;

// Title search for the admin pickers. Matches anywhere in the title, ranking
// matches at the start of a word first, then the most-liked soundtracks.
export function searchSoundtracks(
  list: Soundtrack[],
  query: string,
  limit = 10,
): Soundtrack[] {
  const q = normalizeTitle(query);
  if (!q) return [];
  return list
    .map((s) => {
      const t = normalizeTitle(s.game_title ?? "");
      const idx = t.indexOf(q);
      return { s, idx, startsWord: idx === 0 || /\W/.test(t[idx - 1] ?? "") };
    })
    .filter((r) => r.idx !== -1)
    .sort(
      (a, b) =>
        Number(b.startsWord) - Number(a.startsWord) ||
        likesOf(b.s) - likesOf(a.s) ||
        (a.s.game_title ?? "").localeCompare(b.s.game_title ?? ""),
    )
    .slice(0, limit)
    .map((r) => r.s);
}
