import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { resolve } from 'path'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().split('T')[0]),
  },
  // @ts-ignore — vite-ssg extends the config type at build time
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    async includedRoutes(paths: string[]) {
      const { createClient } = await import('@supabase/supabase-js')
      const { config } = await import('dotenv')
      config()

      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.VITE_SUPABASE_ANON_KEY!,
      )

      const { data: soundtracks } = await supabase
        .from('soundtracks')
        .select('id, composer, genre_tags, mood_tags, theme_tags, console')

      const rows = soundtracks ?? []

      const soundtrackPaths = rows.map((s: any) => `/soundtrack/${s.id}`)

      const composerPaths = [
        ...new Set(rows.map((s: any) => toSlug(s.composer))),
      ].map((slug) => `/composer/${slug}`)

      const categoryEntries: string[] = []
      for (const s of rows) {
        for (const tag of s.genre_tags  ?? []) categoryEntries.push(`/category/genre/${toSlug(tag)}`)
        for (const tag of s.mood_tags   ?? []) categoryEntries.push(`/category/mood/${toSlug(tag)}`)
        for (const tag of s.theme_tags  ?? []) categoryEntries.push(`/category/theme/${toSlug(tag)}`)
        if (s.console) categoryEntries.push(`/category/console/${toSlug(s.console)}`)
      }
      const categoryPaths = [...new Set(categoryEntries)]

      const staticPaths = paths.filter((p) => !p.includes(':'))
      return [...staticPaths, ...soundtrackPaths, ...composerPaths, ...categoryPaths]
    },
  },
})
