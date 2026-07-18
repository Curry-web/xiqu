import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import OnboardingView from '../views/OnboardingView.vue'
import OpeningDetailView from '../views/OpeningDetailView.vue'
import OperaTextDetailView from '../views/OperaTextDetailView.vue'
import OperaView from '../views/OperaView.vue'
import ProfileView from '../views/ProfileView.vue'
import StageView from '../views/StageView.vue'
import TicketView from '../views/TicketView.vue'

const ONBOARDING_STORAGE_KEY = 'xiqu.onboarding.seen'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/onboarding',
      name: 'onboarding',
      component: OnboardingView,
      meta: {
        title: '启动页 - 戏曲',
        showTabbar: false,
      },
    },
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: {
        title: '戏曲',
      },
    },
    {
      path: '/opera',
      name: 'opera',
      component: OperaView,
      meta: {
        title: '戏单 - 戏曲',
      },
    },
    {
      path: '/opening/:id',
      name: 'opening-detail',
      component: OpeningDetailView,
      meta: {
        title: '今日开场 - 戏曲',
        showTabbar: false,
      },
    },
    {
      path: '/opening/:id/text/:sectionType',
      name: 'opera-text-detail',
      component: OperaTextDetailView,
      meta: {
        title: '戏文详情 - 戏曲',
        showTabbar: false,
      },
    },
    {
      path: '/ticket',
      name: 'ticket',
      component: TicketView,
      meta: {
        title: '票务 - 戏曲',
      },
    },
    {
      path: '/stage',
      name: 'stage',
      component: StageView,
      meta: {
        title: '戏台 - 戏曲',
      },
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileView,
      meta: {
        title: '我的 - 戏曲',
      },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: {
        title: '登录 - 戏曲',
        showTabbar: false,
      },
    },
  ],
})

router.beforeEach((to) => {
  if (typeof window !== 'undefined' && to.name !== 'onboarding') {
    const hasSeenOnboarding = window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1'

    if (!hasSeenOnboarding) {
      return { name: 'onboarding' }
    }
  }

  document.title = typeof to.meta.title === 'string' ? to.meta.title : '戏曲'
})

export default router
