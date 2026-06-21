import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '@/views/LandingView.vue'
import HomeView from '@/views/HomeView.vue'
import ComposerView from '@/views/ComposerView.vue'
import TopView from '@/views/TopView.vue'
import TopComposersView from '@/views/TopComposersView.vue'
import ExploreView from '@/views/ExploreView.vue'
import CategoryView from '@/views/CategoryView.vue'
import SoundtrackView from '@/views/SoundtrackView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',                        component: LandingView },
    { path: '/discover',                component: HomeView },
    { path: '/soundtrack/:id',          component: SoundtrackView },
    { path: '/composer/:slug',          component: ComposerView },
    { path: '/top',                     component: TopView },
    { path: '/top-composers',           component: TopComposersView },
    { path: '/explore',                 component: ExploreView },
    { path: '/category/:type/:slug',    component: CategoryView },
  ],
})
