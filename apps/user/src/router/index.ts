import { doneProgress, lazyView, startProgress, type Permission } from '@mindforge/shared'
import { createRouter, createWebHistory } from 'vue-router'

import { setSessionExpiredHandler, tokenStore } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'

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
      component: lazyView(() => import('@/views/LoginView.vue')),
    },
    {
      path: '/register',
      name: 'register',
      component: lazyView(() => import('@/views/RegisterView.vue')),
    },
    {
      path: '/forbidden',
      name: 'forbidden',
      component: lazyView(() => import('@/views/ForbiddenView.vue')),
    },
    {
      path: '/',
      component: lazyView(() => import('@/layouts/UserLayout.vue')),
      redirect: { name: 'workspace' },
      children: [
        {
          path: 'workspace',
          name: 'workspace',
          component: lazyView(() => import('@/views/WorkspaceView.vue')),
          meta: { title: '工作台', icon: 'HomeFilled', order: 1 },
        },
        {
          path: 'resumes',
          name: 'resumes',
          component: lazyView(() => import('@/views/ResumeListView.vue')),
          meta: { title: '我的简历', icon: 'Document', order: 2, permission: 'app:resume:read' },
        },
        {
          // 详情不进菜单（没有 title），只能从列表点进来
          path: 'resumes/:id',
          name: 'resume-detail',
          component: lazyView(() => import('@/views/ResumeDetailView.vue')),
          meta: { permission: 'app:resume:read' },
        },
        {
          path: 'jobs',
          name: 'jobs',
          component: lazyView(() => import('@/views/JobListView.vue')),
          meta: { title: '目标职位', icon: 'Briefcase', order: 3, permission: 'app:job:read' },
        },
        {
          // 详情不进菜单（没有 title），只能从列表点进来
          path: 'jobs/:id',
          name: 'job-detail',
          component: lazyView(() => import('@/views/JobDetailView.vue')),
          meta: { permission: 'app:job:read' },
        },
        {
          path: 'interviews',
          name: 'interviews',
          component: lazyView(() => import('@/views/InterviewListView.vue')),
          meta: {
            title: '模拟面试',
            icon: 'Microphone',
            order: 4,
            permission: 'app:interview:read',
          },
        },
        {
          // 面试间（五步流程 + 报告）。不进菜单。
          path: 'interviews/:id',
          name: 'interview-room',
          component: lazyView(() => import('@/views/InterviewRoomView.vue')),
          meta: { permission: 'app:interview:read' },
        },
        {
          path: 'knowledge',
          name: 'knowledge',
          component: lazyView(() => import('@/views/KnowledgeListView.vue')),
          meta: { title: '知识库', icon: 'Collection', order: 5, permission: 'app:knowledge:read' },
        },
        {
          // 库详情（文档列表 + 上传）。不进菜单。
          path: 'knowledge/:id',
          name: 'knowledge-detail',
          component: lazyView(() => import('@/views/KnowledgeDetailView.vue')),
          meta: { permission: 'app:knowledge:read' },
        },
        {
          // 语义检索（只查不生成）。order 5.5 让它紧挨着「知识库」——
          // 它搜的就是知识库里的内容，放一起用户才找得到
          path: 'search',
          name: 'knowledge-search',
          component: lazyView(() => import('@/views/KnowledgeSearchView.vue')),
          meta: { title: '知识搜索', icon: 'Search', order: 5.5, permission: 'app:rag:search' },
        },
        {
          path: 'chat',
          name: 'chat',
          component: lazyView(() => import('@/views/ChatView.vue')),
          meta: { title: 'AI 问答', icon: 'ChatDotRound', order: 6, permission: 'app:rag:search' },
        },
        {
          // 五维打分对比。order 4.5 让它排在「模拟面试」和「知识库」之间
          path: 'offers',
          name: 'offers',
          component: lazyView(() => import('@/views/OffersView.vue')),
          meta: { title: 'Offer 对比', icon: 'Trophy', order: 4.5, permission: 'app:offer:read' },
        },
        {
          path: 'profile',
          name: 'profile',
          component: lazyView(() => import('@/views/ProfileView.vue')),
          meta: { title: '个人资料', icon: 'User', order: 90 },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: lazyView(() => import('@/views/NotFoundView.vue')),
    },
  ],
})

// 会话彻底失效（刷新也失败）→ 清状态 + 跳登录
setSessionExpiredHandler(() => {
  useAuthStore().reset()
  void router.replace({ name: 'login' })
})

let pendingFetchMe: Promise<void> | null = null

router.beforeEach(async (to, from) => {
  if (to.path !== from.path) {
    startProgress()
  }

  const auth = useAuthStore()
  const hasToken = tokenStore.getAccess() !== null

  // 登录 / 注册页：已登录的话别让用户再看它
  if (to.name === 'login' || to.name === 'register') {
    return hasToken ? { name: 'workspace' } : true
  }

  if (!hasToken) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // 刷新页面后 Pinia 是空的 —— 补拉一次当前用户（单飞保护，防并发竞态）。
  if (!auth.loaded) {
    pendingFetchMe ??= auth.fetchMe().finally(() => {
      pendingFetchMe = null
    })
    try {
      await pendingFetchMe
    } catch {
      auth.reset()
      return { name: 'login', query: { redirect: to.fullPath } }
    }
  }

  // 权限守卫。
  // ⚠️ 这只是 UX —— 后端每个接口都有 @PreAuthorize，那才是真防线。
  const required = to.meta.permission
  if (required && !auth.can(required)) {
    ElMessage.warning({
      message: `您暂无权限访问「${to.meta.title || '该页面'}」，请联系管理员分配对应权限`,
      grouping: true,
    })
    return { name: 'forbidden' }
  }

  return true
})

router.afterEach(() => {
  doneProgress()
})

router.onError((error) => {
  doneProgress()
  // 动态导入分包在 dev 阶段被 Vite 依赖优化中断时自动重试刷新
  if (
    error?.message &&
    /fetch dynamically imported module|Importing a module script failed/i.test(error.message)
  ) {
    window.location.reload()
  }
})

export default router
