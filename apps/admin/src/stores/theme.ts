import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

/**
 * 管理端的主题（浅色 / 深色）。
 *
 * 为什么单独一个 store 而不是在组件里 useState：
 * 主题是**全局单例状态**（同时影响 Element Plus 变量、body 背景、玻璃材质），
 * 而且要在多个地方读写（顶栏切换、将来的设置页）。放组件里会变成
 * 「谁先挂载谁说了算」，刷新页面后还会丢。
 *
 * ★ 落地的三个环节，缺一不可：
 *   ① index.html 里的内联脚本 —— 在首屏渲染前就把 data-theme 挂上（防 FOUC）
 *   ② 这个 store —— 运行时的唯一真相，负责写 localStorage
 *   ③ main.ts 里主动 useThemeStore() —— 保证进应用时 store 一定被创建过
 * 只做 ② 的话，用户刷新页面会先看到浅色闪一下再变深色。
 */

export type ThemeMode = 'light' | 'dark'

/** ⚠️ 这个 key 和 index.html 里内联脚本读的必须一致，改一处要改两处 */
const STORAGE_KEY = 'mf_admin_theme'

function readStored(): ThemeMode {
  // 只认合法值 —— 脏数据（比如手工改过、旧版本遗留）一律回落到浅色
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'dark' ? 'dark' : 'light'
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(readStored())
  const isDark = computed(() => mode.value === 'dark')

  function set(next: ThemeMode): void {
    mode.value = next
  }

  function toggle(): void {
    mode.value = isDark.value ? 'light' : 'dark'
  }

  /**
   * 唯一的副作用出口：把 mode 同步到 <html data-theme> 和 localStorage。
   *
   * ⚠️ immediate: true 是必须的 —— 刷新页面后 store 重建，
   * 得立刻把「从 localStorage 读到的值」重新挂回 DOM（index.html 只保证了首帧）。
   */
  watch(
    mode,
    (next) => {
      document.documentElement.setAttribute('data-theme', next)
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // 隐私模式 / 存储写满时写不进去 —— 主题本次会话仍然生效，只是下次打开会回到默认
      }
    },
    { immediate: true },
  )

  return { mode, isDark, set, toggle }
})
