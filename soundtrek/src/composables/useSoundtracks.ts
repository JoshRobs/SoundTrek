import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { mockSoundtracks } from '@/data/mockSoundtracks'
import type { Soundtrack, FilterState } from '@/types/soundtrack'

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true'

export function useSoundtracks() {
  const allSoundtracks = ref<Soundtrack[]>([])
  const seenIds = ref<Set<string>>(new Set())
  const currentSoundtrack = ref<Soundtrack | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const filters = ref<FilterState>({ moods: [], genres: [], consoles: [] })

  const availableMoods = computed(() => {
    const set = new Set<string>()
    allSoundtracks.value.forEach(s => s.mood_tags.forEach(t => set.add(t)))
    return [...set].sort()
  })

  const availableGenres = computed(() => {
    const set = new Set<string>()
    allSoundtracks.value.forEach(s => s.genre_tags.forEach(t => set.add(t)))
    return [...set].sort()
  })

  const availableConsoles = computed(() => {
    const set = new Set<string>()
    allSoundtracks.value.forEach(s => set.add(s.console))
    return [...set].sort()
  })

  const filteredPool = computed(() => {
    return allSoundtracks.value.filter(s => {
      if (filters.value.moods.length && !filters.value.moods.some(m => s.mood_tags.includes(m))) return false
      if (filters.value.genres.length && !filters.value.genres.some(g => s.genre_tags.includes(g))) return false
      if (filters.value.consoles.length && !filters.value.consoles.includes(s.console)) return false
      return true
    })
  })

  const unseenPool = computed(() =>
    filteredPool.value.filter(s => !seenIds.value.has(s.id))
  )

  const poolExhausted = computed(() => unseenPool.value.length === 0)

  async function fetchSoundtracks() {
    loading.value = true
    error.value = null

    if (USE_MOCK) {
      allSoundtracks.value = mockSoundtracks
      loading.value = false
      pickNext()
      return
    }

    try {
      const { data, error: err } = await supabase
        .from('soundtracks')
        .select('*')
        .order('created_at', { ascending: true })

      if (err) throw err
      allSoundtracks.value = data ?? []
      pickNext()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load soundtracks.'
    } finally {
      loading.value = false
    }
  }

  function pickNext() {
    let pool = unseenPool.value

    // All seen — reset the session and start fresh
    if (pool.length === 0) {
      seenIds.value.clear()
      pool = filteredPool.value
    }

    if (pool.length === 0) return

    const pick = pool[Math.floor(Math.random() * pool.length)]
    seenIds.value.add(pick.id)
    currentSoundtrack.value = pick
  }

  function nextSoundtrack() {
    pickNext()
  }

  function resetFilters() {
    filters.value = { moods: [], genres: [], consoles: [] }
  }

  return {
    currentSoundtrack,
    loading,
    error,
    filters,
    filteredPool,
    poolExhausted,
    availableMoods,
    availableGenres,
    availableConsoles,
    fetchSoundtracks,
    nextSoundtrack,
    resetFilters,
  }
}
