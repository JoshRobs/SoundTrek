import { computed, ref } from "vue";

// Module-scoped (singleton) so every CoverCard instance shares one active-menu
// id — opening one card's mobile menu closes whichever other card had it open.
const activeMenuId = ref<symbol | null>(null);

export function useMobileCardMenu() {
  const id = Symbol("cover-card-menu");
  const isOpen = computed(() => activeMenuId.value === id);

  function open() {
    activeMenuId.value = id;
  }

  function close() {
    if (activeMenuId.value === id) activeMenuId.value = null;
  }

  function toggle() {
    activeMenuId.value = isOpen.value ? null : id;
  }

  return { isOpen, open, close, toggle };
}
