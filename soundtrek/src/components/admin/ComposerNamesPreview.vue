<script setup lang="ts">
// Preview of a comma-separated composer field, checked against every composer
// already credited in the catalog. Composer pages and bios are keyed by slug,
// so a typo or alternate spelling silently creates a second composer — this
// flags new names, suggests likely existing matches, and offers the
// catalog's spelling when only case/accents differ.
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useSoundtrackStore } from "@/stores/soundtracks";
import { toSlug } from "@/utils/slug";
import { splitComposerNames } from "@/utils/composerNames";

const model = defineModel<string>({ required: true });

const { allSoundtracks } = storeToRefs(useSoundtrackStore());

interface KnownComposer {
  slug: string;
  name: string; // most-credited spelling
  credits: number;
  tokens: string[];
}

const known = computed(() => {
  const spellingsBySlug = new Map<string, Map<string, number>>();
  for (const s of allSoundtracks.value) {
    for (const name of s.composers ?? []) {
      const slug = toSlug(name);
      if (!slug) continue;
      const spellings = spellingsBySlug.get(slug) ?? new Map<string, number>();
      spellings.set(name, (spellings.get(name) ?? 0) + 1);
      spellingsBySlug.set(slug, spellings);
    }
  }
  const bySlug = new Map<string, KnownComposer>();
  for (const [slug, spellings] of spellingsBySlug) {
    let name = "";
    let best = 0;
    let credits = 0;
    for (const [spelling, n] of spellings) {
      credits += n;
      if (n > best) [name, best] = [spelling, n];
    }
    bySlug.set(slug, { slug, name, credits, tokens: slug.split("-") });
  }
  return bySlug;
});

// Edit distance with an early exit once it exceeds `max`.
function withinDistance(a: string, b: string, max: number): number | null {
  if (Math.abs(a.length - b.length) > max) return null;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return null;
    prev = cur;
  }
  return prev[b.length] <= max ? prev[b.length] : null;
}

// Likely existing composers for a name not in the catalog: small typos,
// swapped name order ("Shimomura Yoko"), or an added/dropped middle name.
function suggestionsFor(slug: string): KnownComposer[] {
  const tokens = slug.split("-");
  const sortedKey = [...tokens].sort().join("-");
  const maxDist = slug.length >= 10 ? 2 : 1;
  const scored: { c: KnownComposer; score: number }[] = [];
  for (const c of known.value.values()) {
    const dist = withinDistance(slug, c.slug, maxDist);
    if (dist !== null) {
      scored.push({ c, score: dist });
      continue;
    }
    if ([...c.tokens].sort().join("-") === sortedKey) {
      scored.push({ c, score: 1 });
      continue;
    }
    const [shorter, longer] =
      tokens.length <= c.tokens.length ? [tokens, c.tokens] : [c.tokens, tokens];
    if (
      shorter.length >= 2 &&
      shorter.length < longer.length &&
      shorter.every((t) => longer.includes(t))
    ) {
      scored.push({ c, score: 2 });
    }
  }
  return scored
    .sort((a, b) => a.score - b.score || b.c.credits - a.c.credits)
    .slice(0, 3)
    .map((s) => s.c);
}

type Entry =
  | { kind: "known"; name: string; credits: number }
  | { kind: "respell"; name: string; canonical: string; credits: number }
  | { kind: "new"; name: string; suggestions: KnownComposer[] };

const entries = computed<Entry[]>(() =>
  splitComposerNames(model.value).map((name) => {
    const slug = toSlug(name);
    const match = known.value.get(slug);
    if (match) {
      return match.name === name
        ? { kind: "known", name, credits: match.credits }
        : { kind: "respell", name, canonical: match.name, credits: match.credits };
    }
    return { kind: "new", name, suggestions: slug ? suggestionsFor(slug) : [] };
  }),
);

function replace(index: number, replacement: string) {
  const names = splitComposerNames(model.value);
  names[index] = replacement;
  model.value = splitComposerNames(names.join(", ")).join(", ");
}

const games = (n: number) => `${n} game${n === 1 ? "" : "s"}`;
</script>

<template>
  <div v-if="entries.length" class="composer-preview">
    <div
      v-for="(e, i) in entries"
      :key="e.name"
      class="entry"
      :class="`entry--${e.kind}`"
    >
      <span
        class="chip"
        :title="e.kind === 'new' ? 'Not credited anywhere in the catalog yet' : `Credited on ${games(e.credits)}`"
      >
        {{ e.name }}
        <span v-if="e.kind === 'new'" class="badge">new</span>
        <span v-else-if="e.kind === 'known'" class="count">{{ e.credits }}</span>
      </span>

      <button
        v-if="e.kind === 'respell'"
        type="button"
        class="suggest"
        :title="`Catalog spelling, credited on ${games(e.credits)}`"
        @click="replace(i, e.canonical)"
      >
        Use “{{ e.canonical }}”
      </button>

      <template v-if="e.kind === 'new' && e.suggestions.length">
        <span class="hint">Did you mean</span>
        <button
          v-for="s in e.suggestions"
          :key="s.slug"
          type="button"
          class="suggest"
          :title="`Credited on ${games(s.credits)}`"
          @click="replace(i, s.name)"
        >
          {{ s.name }} <span class="count">{{ s.credits }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.composer-preview {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: 0.4rem;
}

.entry {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 99px;
  padding: 0.2rem 0.65rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.entry--new .chip,
.entry--respell .chip {
  border-color: rgba(251, 191, 36, 0.45);
  color: #fbbf24;
}

.badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.count {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.suggest {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: none;
  border: 1px dashed var(--border);
  border-radius: 99px;
  padding: 0.15rem 0.6rem;
  font: inherit;
  font-size: 0.78rem;
  color: var(--accent-light);
  cursor: pointer;
}
.suggest:hover {
  border-color: var(--accent-light);
}
</style>
