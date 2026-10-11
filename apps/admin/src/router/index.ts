import type { Permission } from '@mindforge/shared'
import { createRouter, createWebHistory } from 'vue-router'

import { setSessionExpiredHandler, tokenStore } from '@/api'
import { useAuthStore } from '@/stores/auth'

// 给路由的 meta 补上我们自己的字段
declare module 'vue-router' {
  interface RouteMeta {
    /** 访问这个页面需要的权限码。不写 = 登录即可 */
    permission?: Permission
    /** 侧边栏里的名字。不写 = 不进菜单（登录页 / 404 这类） */
    title?: string
    /** 侧边栏图标（@element-plus/icons-vue 的组件名） */
    icon?: string
    /** 菜单排序，小的在前 */
    order?: number
  }
}

const router = createRouter({
  /**
   * ⚠️ 用 `import.meta.env.BASE_URL` 而不是硬编码 '/admin/' ——
   * 它等于 vite.config.ts 里的 `base`，改一处两边都对。
   * 硬编码的话，换个部署路径（比如放到 /console/）就会全部 404。
   */
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/forbidden',
      name: 'forbidden',
      component: () => import('@/views/ForbiddenView.vue'),
    },
    {
      path: '/',
      component: () => import('@/layouts/AdminLayout.vue'),
      redirect: { name: 'dashboard' },
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
          meta: { title: '首页', icon: 'Odometer', order: 1, permission: 'admin:dashboard:read' },
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/views/UserListView.vue'),
          meta: { title: '用户管理', icon: 'User', order: 2, permission: 'admin:user:list' },
        },
        {
          path: 'roles',
          name: 'roles',
          component: () => import('@/views/RoleListView.vue'),
          meta: { title: '角色权限', icon: 'Key', order: 3, permission: 'admin:role:list' },
        },
        {
          path: 'knowledge-bases',
          name: 'knowledge-bases',
          component: () => import('@/views/KnowledgeListView.vue'),
          meta: {
            title: '知识库',
            icon: 'Collection',
            order: 4,
            permission: 'admin:knowledge:list',
          },
        },
        {
          path: 'documents',
          name: 'documents',
          component: () => import('@/views/DocumentListView.vue'),
          meta: { title: '文档', icon: 'Document', order: 5, permission: 'admin:document:list' },
        },
        {
          path: 'ai-models',
          name: 'ai-models',
          component: () => import('@/views/AiModelListView.vue'),
          meta: { title: 'AI 配置', icon: 'Cpu', order: 6, permission: 'admin:ai:manage' },
        },
        {
          path: 'audit-logs',
          name: 'audit-logs',
          component: () => import('@/views/AuditLogListView.vue'),
          meta: { title: '审计日志', icon: 'Tickets', order: 7, permission: 'admin:audit:list' },
        },
        {
          path: 'prompts',
          name: 'prompts',
          component: () => import('@/views/PromptListView.vue'),
          meta: {
            title: 'Prompt 管理',
            icon: 'EditPen',
            order: 8,
            permission: 'admin:prompt:manage',
          },
        },
        {
          path: 'usage',
          name: 'usage',
          component: () => import('@/views/UsageView.vue'),
          meta: { title: 'AI 用量', icon: 'TrendCharts', order: 9, permission: 'admin:usage:read' },
        },
        {
          path: 'alerts',
          name: 'alerts',
          component: () => import('@/views/AlertListView.vue'),
          meta: { title: '高危告警', icon: 'Bell', order: 10, permission: 'admin:alert:list' },
        },
        {
          // 开发用的设计规范页 —— 不设 permission（登录即可看）
          path: 'style-guide',
          name: 'style-guide',
          component: () => import('@/views/StyleGuideView.vue'),
          meta: { title: '设计规范', icon: 'Brush', order: 90 },
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

  // 登录页：已登录的话别让用户再看它
  if (to.name === 'login') {
    return hasToken ? { name: 'dashboard' } : true
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
  //    前端拦住了只是不让用户看到进不去的页面，拦不住有心人直接发请求。
  const required = to.meta.permission
  if (required && !auth.can(required)) {
    // 注意别死循环：如果连目标页自己都是「去 dashboard」，那就去 403 页
    return to.name === 'dashboard' ? { name: 'forbidden' } : { name: 'dashboard' }
  }

  return true
})

export default router
