import { ViteSSG } from "vite-ssg";
import { createPinia } from "pinia";
import "./style.css";
import App from "./App.vue";
import { routes, scrollBehavior, setupScrollGuards } from "./router";

// vite-ssg installs the head manager itself (server head during prerender,
// client head in the browser) and writes it into each page's HTML. Don't add
// another one here — a second instance swallows every useHead() call, so the
// prerendered pages would all ship index.html's homepage tags.
export const createApp = ViteSSG(
  App,
  { routes, scrollBehavior },
  ({ app, router }) => {
    app.use(createPinia());
    if (!import.meta.env.SSR) setupScrollGuards(router);
  },
);
