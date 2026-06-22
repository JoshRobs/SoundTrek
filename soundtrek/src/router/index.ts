import { nextTick } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '@/views/LandingView.vue'
import HomeView from '@/views/HomeView.vue'
import ComposerView from '@/views/ComposerView.vue'
import TopView from '@/views/TopView.vue'
import TopComposersView from '@/views/TopComposersView.vue'
import ExploreView from '@/views/ExploreView.vue'
import CategoryView from '@/views/CategoryView.vue'
import SoundtrackView from '@/views/SoundtrackView.vue'
import CatalogView from '@/views/CatalogView.vue'
import SubmitView from '@/views/SubmitView.vue'
import ContactView from '@/views/ContactView.vue'

const scrollPositions = new Map<string, number>()
let shouldRestore = false

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(_to, _from, savedPosition) {
    shouldRestore = !!savedPosition
    return false
  },
  routes: [
    { path: '/',                        component: LandingView },
    { path: '/discover',                component: HomeView },
    { path: '/soundtrack/:id',          component: SoundtrackView },
    { path: '/composer/:slug',          component: ComposerView },
    { path: '/top',                     component: TopView },
    { path: '/top-composers',           component: TopComposersView },
    { path: '/explore',                 component: ExploreView },
    { path: '/category/:type/:slug',    component: CategoryView },
    { path: '/catalog',                 component: CatalogView },
    { path: '/submit',                  component: SubmitView },
    { path: '/contact',                 component: ContactView },
  ],
})

router.beforeEach((_, from) => {
  const el = document.getElementById('app-main')
  if (el) scrollPositions.set(from.fullPath, el.scrollTop)
})

router.afterEach((to) => {
  nextTick(() => {
    const el = document.getElementById('app-main')
    if (!el) return
    el.scrollTop = shouldRestore ? (scrollPositions.get(to.fullPath) ?? 0) : 0
  })
})

export default router
