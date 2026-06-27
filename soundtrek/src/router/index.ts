import { nextTick } from "vue";
import {
  type Router,
  type RouteRecordRaw,
  type RouteLocationNormalized,
  type RouteLocationNormalizedLoaded,
} from "vue-router";
import LandingView from "@/views/LandingView.vue";
import HomeView from "@/views/HomeView.vue";
import ComposerView from "@/views/ComposerView.vue";
import StudioView from "@/views/StudioView.vue";
import TopView from "@/views/TopView.vue";
import TopComposersView from "@/views/TopComposersView.vue";
import StudiosView from "@/views/StudiosView.vue";
import ExploreView from "@/views/ExploreView.vue";
import CategoryView from "@/views/CategoryView.vue";
import SoundtrackView from "@/views/SoundtrackView.vue";
import CatalogView from "@/views/CatalogView.vue";
import SubmitView from "@/views/SubmitView.vue";
import ContactView from "@/views/ContactView.vue";
import PrivacyView from "@/views/PrivacyView.vue";
import TermsView from "@/views/TermsView.vue";
import NotFoundView from "@/views/NotFoundView.vue";

export const routes: RouteRecordRaw[] = [
  { path: "/", component: LandingView },
  { path: "/discover", component: HomeView },
  { path: "/soundtrack/:id", component: SoundtrackView },
  { path: "/composer/:slug", component: ComposerView },
  { path: "/studio/:slug", component: StudioView },
  { path: "/top", component: TopView },
  { path: "/top-composers", component: TopComposersView },
  { path: "/studios", component: StudiosView },
  { path: "/explore", component: ExploreView },
  { path: "/category/:type/:slug", component: CategoryView },
  { path: "/catalog", component: CatalogView },
  { path: "/submit", component: SubmitView },
  { path: "/contact", component: ContactView },
  { path: "/privacy-policy", component: PrivacyView },
  { path: "/terms-of-service", component: TermsView },
  { path: "/:pathMatch(.*)*", component: NotFoundView },
];

const scrollPositions = new Map<string, number>();
let shouldRestore = false;

export function scrollBehavior(
  _to: RouteLocationNormalized,
  _from: RouteLocationNormalizedLoaded,
  savedPosition: { left: number; top: number } | null,
): false {
  shouldRestore = !!savedPosition;
  return false;
}

export function setupScrollGuards(router: Router) {
  router.beforeEach((_, from) => {
    const el = document.getElementById("app-main");
    if (el) scrollPositions.set(from.fullPath, el.scrollTop);
  });
  router.afterEach((to) => {
    nextTick(() => {
      const el = document.getElementById("app-main");
      if (!el) return;
      el.scrollTop = shouldRestore
        ? (scrollPositions.get(to.fullPath) ?? 0)
        : 0;
    });
  });
}
