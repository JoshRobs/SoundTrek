import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import { resolve } from "path";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true, // or '0.0.0.0'
  },
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().split("T")[0]),
  },
  // @ts-ignore — vite-ssg extends the config type at build time
  ssgOptions: {
    script: "async",
    formatting: "minify",
    async includedRoutes(paths: string[]) {
      const { createClient } = await import("@supabase/supabase-js");
      const { config } = await import("dotenv");
      config();

      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.VITE_SUPABASE_ANON_KEY!,
      );

      // PostgREST caps a select at 1000 rows, so page through the table —
      // otherwise everything past the first 1000 soundtracks isn't prerendered.
      const rows: any[] = [];
      const PAGE_SIZE = 1000;
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from("soundtracks")
          .select("id, slug, composers, studio, genre_tags, theme_tags, console")
          .order("id")
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < PAGE_SIZE) break;
      }

      const soundtrackPaths = rows.map((s: any) => `/soundtrack/${s.slug ?? s.id}`);

      const composerPaths = [
        ...new Set(rows.flatMap((s: any) => (s.composers ?? []).map(toSlug))),
      ].map((slug) => `/composer/${slug}`);

      const studioPaths = [
        ...new Set(rows.filter((s: any) => s.studio).map((s: any) => toSlug(s.studio))),
      ].map((slug) => `/studio/${slug}`);

      const categoryEntries: string[] = [];
      for (const s of rows) {
        for (const tag of s.genre_tags ?? [])
          categoryEntries.push(`/category/genre/${toSlug(tag)}`);
        for (const tag of s.theme_tags ?? [])
          categoryEntries.push(`/category/theme/${toSlug(tag)}`);
        if (s.console)
          categoryEntries.push(`/category/console/${toSlug(s.console)}`);
      }
      const categoryPaths = [...new Set(categoryEntries)];

      const staticPaths = paths.filter((p) => !p.includes(":"));
      return [
        ...staticPaths,
        ...soundtrackPaths,
        ...composerPaths,
        ...studioPaths,
        ...categoryPaths,
      ];
    },
  },
});
