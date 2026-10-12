import { createPinia } from 'pinia'
import { createApp } from 'vue'

// ⚠️ 顺序：先共享的设计 token，再本端自己的全局样式。
//    Element Plus 的组件样式是 unplugin 按需注入的（跟着组件 chunk 走），
//    所以那边的顺序没法控制 —— 我们的 token 靠 :root:root 提权重来稳定生效，
//    细节见 packages/shared/styles/element-plus.css 里的说明。
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
