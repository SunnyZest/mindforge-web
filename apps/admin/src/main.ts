import { createPinia } from 'pinia'
import { createApp } from 'vue'

// ⚠️ 顺序：先共享的设计 token，再本端自己的全局样式。
//    Element Plus 的组件样式是 unplugin 按需注入的（跟着组件 chunk 走），
//    所以那边的顺序没法控制 —— 我们的 token 靠 :root:root 提权重来稳定生效，
//    细节见 packages/shared/styles/element-plus.css 里的说明。
import '@mindforge/shared/styles'
import './styles/index.css'

import App from './App.vue'
import router from './router'
import { useThemeStore } from './stores/theme'

const app = createApp(App)

// ⚠️ 顺序有讲究：pinia 必须在 router 之前装上 ——
// 路由守卫里会 `useAuthStore()`，pinia 没装的话那里会直接报错。
const pinia = createPinia()
app.use(pinia)
app.use(router)

// 主题：store 一创建就把 data-theme 挂到 <html> 上（见 stores/theme.ts）。
// 显式把 pinia 传进去，不依赖「当前活跃实例」这种隐式状态。
useThemeStore(pinia)

app.mount('#app')
