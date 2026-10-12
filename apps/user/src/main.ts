import { createPinia } from 'pinia'
import { createApp } from 'vue'

// ⚠️ 顺序：先共享的设计 token，再本端自己的全局样式。
//    详见 apps/admin/src/main.ts 的说明。
import '@mindforge/shared/styles'
import './styles/index.css'

import { setupAmbientBackground } from '@mindforge/shared'

import App from './App.vue'
import router from './router'
import { useThemeStore } from './stores/theme'

setupAmbientBackground()

const app = createApp(App)

// pinia 必须在 router 之前装 —— 路由守卫里会 useAuthStore()
const pinia = createPinia()
app.use(pinia)
app.use(router)

// 主题：store 一创建就把 data-theme 挂到 <html> 上（见 stores/theme.ts）。
// index.html 的内联脚本只保证了首帧，这里是运行时的唯一真相。
useThemeStore(pinia)

app.mount('#app')
