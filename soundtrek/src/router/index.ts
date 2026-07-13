import { nextTick } from "vue";
import {
  type Router,
  type RouteRecordRaw,
  type RouteLocationNormalized,
  type RouteLocationNormalizedLoaded,
} from "vue-router";
import { supabase } from "@/lib/supabase";
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
import CollectionsView from "@/views/CollectionsView.vue";
import BrowseCollectionsView from "@/views/BrowseCollectionsView.vue";
import CollectionView from "@/views/CollectionView.vue";
import PrivacyView from "@/views/PrivacyView.vue";
import TermsView from "@/views/TermsView.vue";
import SearchView from "@/views/SearchView.vue";
import LoginView from "@/views/LoginView.vue";
import SavedView from "@/views/SavedView.vue";
import AccountView from "@/views/AccountView.vue";
import ResetPasswordView from "@/views/ResetPasswordView.vue";
import AdminLayout from "@/views/admin/AdminLayout.vue";
import AdminDashboard from "@/views/admin/AdminDashboard.vue";
import AdminAddSoundtrack from "@/views/admin/AdminAddSoundtrack.vue";
import AdminEditSoundtrack from "@/views/admin/AdminEditSoundtrack.vue";
import AdminComposers from "@/views/admin/AdminComposers.vue";
import NotFoundView from "@/views/NotFoundView.vue";

export const routes: RouteRecordRaw[] = [
  { path: "/", component: LandingView },
  { path: "/discover", component: HomeView },
  { path: "/soundtrack/:slug", component: SoundtrackView },
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
  { path: "/collections", component: CollectionsView, meta: { requiresAuth: true } },
  { path: "/browse-collections", component: BrowseCollectionsView },
  { path: "/collection/:id", component: CollectionView },
  { path: "/privacy-policy", component: PrivacyView },
  { path: "/terms-of-service", component: TermsView },
  { path: "/search", component: SearchView },
  { path: "/login", component: LoginView },
  { path: "/saved", component: SavedView },
  { path: "/account", component: AccountView },
  { path: "/reset-password", component: ResetPasswordView },
  {
    path: "/admin",
    component: AdminLayout,
    meta: { requiresAdmin: true },
    children: [
      { path: "", component: AdminDashboard },
      { path: "add-soundtrack",  component: AdminAddSoundtrack },
      { path: "edit-soundtrack", component: AdminEditSoundtrack },
      { path: "composers",       component: AdminComposers },
    ],
  },
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
  router.beforeEach(async (to, from) => {
    const el = document.getElementById("app-main");
    if (el) scrollPositions.set(from.fullPath, el.scrollTop);

    if (to.meta.requiresAuth || to.meta.requiresAdmin) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { path: "/login", query: { redirect: to.fullPath } };
      }
      if (to.meta.requiresAdmin && session.user.app_metadata?.role !== "admin") {
        return { path: "/" };
      }
    }
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
