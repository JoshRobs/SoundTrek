import { ref, onMounted, onUnmounted } from "vue";

const MOBILE_BREAKPOINT = "(max-width: 768px)";

export function useIsMobile() {
  const isMobile = ref(false);

  let mql: MediaQueryList | null = null;

  function update(e: MediaQueryListEvent | MediaQueryList) {
    isMobile.value = e.matches;
  }

  onMounted(() => {
    mql = window.matchMedia(MOBILE_BREAKPOINT);
    isMobile.value = mql.matches;
    mql.addEventListener("change", update);
  });

  onUnmounted(() => {
    mql?.removeEventListener("change", update);
  });

  return { isMobile };
}
