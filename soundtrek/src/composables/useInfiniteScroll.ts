import { ref, onMounted, onUnmounted, type Ref } from 'vue'

export function useInfiniteScroll(sentinelEl: Ref<HTMLElement | null | undefined>, load: () => Promise<boolean>) {
  const loading = ref(false)
  const exhausted = ref(false)
  let observer: IntersectionObserver | null = null

  async function trigger() {
    if (loading.value || exhausted.value) return
    loading.value = true
    const hasMore = await load()
    if (!hasMore) exhausted.value = true
    loading.value = false
  }

  onMounted(async () => {
    await trigger()
    if (!sentinelEl.value) return
    observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) trigger() },
      { rootMargin: '300px' },
    )
    observer.observe(sentinelEl.value)
  })

  onUnmounted(() => observer?.disconnect())

  return { loading, exhausted }
}
