import { createApp } from "vue";
import { createPinia } from "pinia";
import { createHead } from "@unhead/vue/client";
import "./style.css";
import App from "./App.vue";
import router from "./router";

createApp(App).use(createPinia()).use(router).use(createHead()).mount("#app");
