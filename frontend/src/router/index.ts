import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
export const PUZZLE_DIFFICULTY_ROUTES = ['beginner', 'easy', 'medium']
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/sudoku/:difficulty',
      name: 'sudoku',
      props: true,
      beforeEnter: (to, _from) => {
        if(typeof to.params.difficulty !== 'string' || !PUZZLE_DIFFICULTY_ROUTES.includes(to.params.difficulty)) {
          return false
        }
      },
      component: () => import('../views/sudoku/Standard.vue')
    },
    // {
    //   path: '/sudoku/hard',
    //   name: 'hard',
    //   component: () => import('../views/sudoku/Standard.vue')
    // },
    // {
    //   path: '/sudoku/impossible',
    //   name: 'impossible',
    //   component: () => import('../views/sudoku/Standard.vue')
    // }
  ],
})

export default router
