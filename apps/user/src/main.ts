import { createPinia } from 'pinia'
import { createApp } from 'vue'

// ⚠️ 顺序：先共享的设计 token，再本端自己的全局样式。
//    详见 apps/admin/src/main.ts 的说明。
import '@mindforge/shared/styles'
import './styles/index.css'

import { setupAmbientBackground } from '@mindforge/shared'

import { tokenStore } from './api'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useThemeStore } from './stores/theme'

async function bootstrap(): Promise<void> {
  setupAmbientBackground()

  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(router)

  useThemeStore(pinia)

  // 若本地存有 token，首屏提前预拉取用户信息与权限状态。
  // 使后续所有页面交互与路由守卫纯同步 (0ms) 执行，从根源消除守卫异步等待与点击冲突。
  const auth = useAuthStore(pinia)
  if (tokenStore.getAccess()) {
    try {
      await auth.fetchMe()
    } catch {
      // 异常时交给路由守卫清理并重定向
    }
  }

  await router.isReady()
  app.mount('#app')
}

void bootstrap()
