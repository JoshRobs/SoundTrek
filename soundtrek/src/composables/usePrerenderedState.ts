import { onServerPrefetch } from "vue";
import { useRoute } from "vue-router";

type PageState = Record<string, unknown>;

/**
 * Loads a page's data at prerender time and ships it inside the page.
 *
 * During the vite-ssg build, `load` runs before the page is rendered, so the
 * static HTML (and its title / description / og tags) contains the real
 * content that crawlers and link-preview bots read. `capture()` is then
 * stored in vite-ssg's initial state (`window.__INITIAL_STATE__`).
 *
 * In the browser, the first page view hands that snapshot to `restore()` and
 * returns true, so the page renders straight away without refetching. It
 * returns false otherwise (client-side navigation, or no prerendered data),
 * and the caller loads the data itself as usual.
 *
 * The snapshot must be JSON-serialisable (no Map/Set).
 */
export function usePrerenderedState<T>(
  name: string,
  options: {
    load: () => Promise<void>;
    capture: () => T;
    restore: (data: T) => void;
  },
): boolean {
  const route = useRoute();
  // vite-ssg puts its initial state object on the entry route's meta, on both
  // the server and the client; later navigations don't carry it.
  const state = route.meta.state as PageState | undefined;
  // Keyed by path too, so a snapshot can't land on a different page.
  const key = `${name}:${route.path}`;

  if (import.meta.env.SSR) {
    onServerPrefetch(async () => {
      await options.load();
      if (state) state[key] = options.capture();
    });
    return false;
  }

  if (!state || !(key in state)) return false;
  const data = state[key] as T;
  // One-shot: revisiting this page later in the session fetches fresh data.
  delete state[key];
  options.restore(data);
  return true;
}
