import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
export const PUZZLE_DIFFICULTY_ROUTES = ["beginner", "easy", "medium", "hard"];
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: "/about",
      name: "about",
      component: () => import("../views/AboutView.vue"),
    },
    {
      path: "/sudoku/:difficulty",
      name: "sudoku",
      props: true,
      beforeEnter: (to, _from) => {
        if (
          typeof to.params.difficulty !== "string" ||
          !PUZZLE_DIFFICULTY_ROUTES.includes(to.params.difficulty)
        ) {
          return false;
        }
      },
      component: () => import("../views/sudoku/Standard.vue"),
    },
    {
      path: "/auth/validateEmail",
      name: "validateEmail",
      component: () => import("../views/ValidateEmailView.vue"),
    },
    {
      path: "/auth/request-email-verification",
      name: "request-email-verification",
      component: () => import("../views/RequestEmailVerificationView.vue"),
    },
    {
      path: "/auth/reset-password",
      name: "reset-password",
      component: () => import("../views/ResetPasswordView.vue"),
    },
    {
      path: "/auth/request-password-reset",
      name: "request-password-reset",
      component: () => import("../views/RequestPasswordResetView.vue"),
    }
  ],
});

export default router;
