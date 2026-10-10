import type { Permission } from '@mindforge/shared'
import { createRouter, createWebHistory } from 'vue-router'

import { setSessionExpiredHandler, tokenStore } from '@/api'
import { useAuthStore } from '@/stores/auth'

// 给路由的 meta 补上我们自己的字段
declare module 'vue-router' {
  interface RouteMeta {
    /** 访问这个页面需要的权限码。不写 = 登录即可 */
    permission?: Permission
    /** 侧边栏里的名字。不写 = 不进菜单（登录 / 注册 / 404 这类） */
    title?: string
    /** 侧边栏图标（@element-plus/icons-vue 的组件名） */
    icon?: string
    /** 菜单排序，小的在前 */
    order?: number
    /** 菜单里标成「未开放」并置灰 —— 页面还没做，先占位让人知道有这功能 */
    comingSoon?: boolean
  }
}

const router = createRouter({
  /**
   * ⚠️ 用 `import.meta.env.BASE_URL` 而不是硬编码 '/' ——
   * 它等于 vite.config.ts 里的 `base`，改一处两边都对。
   * 用户端的 base 是 '/'（管理端是 '/admin/'）。
   */
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
    },
    {
      path: '/forbidden',
      name: 'forbidden',
      component: () => import('@/views/ForbiddenView.vue'),
    },
    {
      path: '/',
      component: () => import('@/layouts/UserLayout.vue'),
      redirect: { name: 'workspace' },
      children: [
        {
          path: 'workspace',
          name: 'workspace',
          component: () => import('@/views/WorkspaceView.vue'),
          meta: { title: '工作台', icon: 'HomeFilled', order: 1 },
        },
        {
          path: 'resumes',
          name: 'resumes',
          component: () => import('@/views/ResumeListView.vue'),
          meta: { title: '我的简历', icon: 'Document', order: 2, permission: 'app:resume:read' },
        },
        {
          // 详情不进菜单（没有 title），只能从列表点进来
          path: 'resumes/:id',
          name: 'resume-detail',
          component: () => import('@/views/ResumeDetailView.vue'),
          meta: { permission: 'app:resume:read' },
        },
        {
          path: 'jobs',
          name: 'jobs',
          component: () => import('@/views/ComingSoonView.vue'),
          meta: {
            title: '目标职位',
            icon: 'Briefcase',
            order: 3,
            permission: 'app:job:read',
            comingSoon: true,
          },
        },
        {
          path: 'interviews',
          name: 'interviews',
          component: () => import('@/views/ComingSoonView.vue'),
          meta: {
            title: '模拟面试',
            icon: 'Microphone',
            order: 4,
            permission: 'app:interview:read',
            comingSoon: true,
          },
        },
        {
          path: 'knowledge',
          name: 'knowledge',
          component: () => import('@/views/ComingSoonView.vue'),
          meta: {
            title: '知识库',
            icon: 'Collection',
            order: 5,
            permission: 'app:knowledge:read',
            comingSoon: true,
          },
        },
        {
          path: 'chat',
          name: 'chat',
          component: () => import('@/views/ComingSoonView.vue'),
          meta: {
            title: 'AI 问答',
            icon: 'ChatDotRound',
            order: 6,
            permission: 'app:rag:search',
            comingSoon: true,
          },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/ProfileView.vue'),
          meta: { title: '个人资料', icon: 'User', order: 90 },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
})

// 会话彻底失效（刷新也失败）→ 清状态 + 跳登录
setSessionExpiredHandler(() => {
  useAuthStore().reset()
  void router.replace({ name: 'login' })
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const hasToken = tokenStore.getAccess() !== null

  // 登录 / 注册页：已登录的话别让用户再看它
  if (to.name === 'login' || to.name === 'register') {
    return hasToken ? { name: 'workspace' } : true
  }

  if (!hasToken) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // 刷新页面后 Pinia 是空的 —— 补拉一次当前用户。
  // 顺便也验证了 token 还有效（无效的话这里会 401 → 刷新 → 还失败 → 抛错）
  if (!auth.loaded) {
    try {
      await auth.fetchMe()
    } catch {
      auth.reset()
      return { name: 'login', query: { redirect: to.fullPath } }
    }
  }

  // 权限守卫。
  // ⚠️ 这只是 UX —— 后端每个接口都有 @PreAuthorize，那才是真防线。
  const required = to.meta.permission
  if (required && !auth.can(required)) {
    // 别死循环：如果连目标页自己都是「去工作台」，那就去 403 页
    return to.name === 'workspace' ? { name: 'forbidden' } : { name: 'workspace' }
  }

  return true
})

export default router
