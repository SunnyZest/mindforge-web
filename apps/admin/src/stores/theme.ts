import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { applyTheme, persistTheme, readStoredTheme, type ThemeMode } from '@mindforge/shared'

/**
 * 管理端的主题（浅色 / 深色）。
 *
 * ★ 读写逻辑在 `@mindforge/shared` 的 theme.ts 里 —— 用户端用的是同一份，
 *   两端只有【storageKey】和【默认值】不同。这里只负责 Vue 的响应式胶水。
 *
 * 为什么用 store 而不是在组件里 useState：
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

/** ⚠️ 这个 key 和 index.html 里内联脚本读的必须一致，改一处要改两处 */
const STORAGE_KEY = 'mf_admin_theme'

/** 管理端默认浅色（用户端相反，默认深色） */
const DEFAULT_MODE: ThemeMode = 'light'

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(readStoredTheme(STORAGE_KEY, DEFAULT_MODE))
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
      applyTheme(next)
      persistTheme(STORAGE_KEY, next)
    },
    { immediate: true },
  )

  return { mode, isDark, set, toggle }
})
