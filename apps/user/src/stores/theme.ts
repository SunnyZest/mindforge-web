import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { applyTheme, persistTheme, readStoredTheme, type ThemeMode } from '@mindforge/shared'

/**
 * 用户端的主题（深色 / 浅色）—— **默认深色，但用户可以自由切到浅色**。
 *
 * ★ 读写逻辑在 `@mindforge/shared` 的 theme.ts 里，管理端用的是同一份。
 *   两端只有下面两个常量不同：
 *     管理端  mf_admin_theme  默认 light
 *     用户端  mf_user_theme   默认 dark
 *
 * ★ 落地的三个环节，缺一不可（漏一个就会出现「刷新时闪一下」或「切了不生效」）：
 *   ① index.html 里的内联脚本 —— 首屏渲染前挂 data-theme（防 FOUC）
 *   ② 这个 store —— 运行时的唯一真相
 *   ③ main.ts 里主动 useThemeStore() —— 保证进应用时它被创建过
 */

/** ⚠️ 必须和 index.html 内联脚本里的 key 一致，改一处要改两处 */
const STORAGE_KEY = 'mf_user_theme'

/** 用户端默认深色（管理端相反） */
const DEFAULT_MODE: ThemeMode = 'dark'

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
   * 唯一的副作用出口：同步到 <html data-theme> 和 localStorage。
   * ⚠️ immediate 必须开 —— 刷新后 store 重建，得立刻把值挂回 DOM。
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
