import { toSlug } from "@/utils/slug";

// Splits a pasted composer list into names. Commas separate names, and the
// standalone word "and" is treated as a separator too, so "A, B, and C" and
// "A and B" both parse cleanly. Word boundaries keep names like "Alexander"
// or "Andy" intact. Names that resolve to the same composer slug (case or
// accent differences) are kept once, first spelling wins.
export function splitComposerNames(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split(/,|\band\b/i)
    .map((s) => s.trim())
    .filter((name) => {
      if (!name) return false;
      const key = toSlug(name) || name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
