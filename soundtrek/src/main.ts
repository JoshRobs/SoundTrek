import { ViteSSG } from "vite-ssg";
import { createPinia } from "pinia";
import { createHead } from "@unhead/vue/client";
import "./style.css";
import App from "./App.vue";
import { routes, scrollBehavior, setupScrollGuards } from "./router";

export const createApp = ViteSSG(
  App,
  { routes, scrollBehavior },
  ({ app, router }) => {
    app.use(createPinia());
    app.use(createHead());
    if (!import.meta.env.SSR) setupScrollGuards(router);
  },
);
