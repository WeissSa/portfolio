import { createRouter, createWebHashHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";

const routes = [
  {
    path: "/",
    name: "home",
    component: HomeView,
  },
  {
    path: "/resume",
    name: "resume",
    component: () =>
      import(/* webpackChunkName: "about" */ "../views/ResumeView.vue"),
  },
  {
    path: "/private",
    name: "private",
    component: () =>
      import(/* webpackChunkName: "about" */ "../views/PrivateView.vue"),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
