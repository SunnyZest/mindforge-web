/**
 * 主题（浅色 / 深色）的公共逻辑 —— **不依赖任何框架**。
 *
 * ★ 为什么放在共享层、且刻意不 import vue：
 *   两个端的主题机制完全一样，只有【storageKey】和【默认值】不同：
 *     管理端  mf_admin_theme  默认浅色
 *     用户端  mf_user_theme   默认深色
 *   机制写两份的话，以后修一个 bug 得记得改两处 —— 漏一处就是两端行为不一致。
 *   而 packages/shared 没有 vue 依赖（只有 axios），加 vue 会引入一层
 *   peerDependency 的安装问题，所以这里只放「纯逻辑」，
 *   各端自己用 ~10 行 Vue 胶水包一下（见各端的 src/stores/theme.ts）。
 *
 * ⚠️ 写这个文件时踩过一次：注释里写了 `apps/*` 加 `/src` 的路径，
 *    其中的 `*` 和 `/` 连在一起会被当成**块注释的结束符**，
 *    后面的文字全变成代码 —— 报一堆莫名其妙的 TS1127。
 *    在块注释里提到通配路径时，别让这两个字符挨着。
 *
 * ★ 落地的三个环节，缺一不可：
 *   ① 各端 index.html 里的**内联脚本** —— 首屏渲染前就把 data-theme 挂上（防 FOUC）
 *   ② 各端的 theme store —— 运行时的唯一真相，负责读写
 *   ③ main.ts 里主动创建 store —— 保证进应用时它一定被实例化
 *   只做 ② 的话，刷新页面会先看到默认主题闪一下再变。
 */

export type ThemeMode = 'light' | 'dark'

/**
 * 挂在 `<html>` 上的属性名。两个端必须一致 ——
 * `theme-dark.css` 就是靠 `[data-theme='dark']` 这个选择器生效的。
 */
export const THEME_ATTR = 'data-theme'

/**
 * 把任意值收敛成合法主题。
 *
 * ⚠️ 必须做这层校验：localStorage 里的值是可以被用户手工改的，
 *    也可能留着旧版本写进去的脏数据。不校验的话 `data-theme="Light"` 这种
 *    会挂上去但匹配不到任何选择器 —— 表现为「主题设置莫名其妙失效」，
 *    而且极难查（属性明明在，就是没效果）。
 */
export function normalizeTheme(value: unknown, fallback: ThemeMode = 'light'): ThemeMode {
  return value === 'dark' || value === 'light' ? value : fallback
}

/**
 * 读 localStorage 里存的主题。
 *
 * ⚠️ 包 try/catch：隐私模式 / 禁用存储时 `localStorage` 本身就可能抛错。
 * ⚠️ 读不到或读出来是脏数据 → 返回 `fallback`（各端的默认主题）。
 */
export function readStoredTheme(storageKey: string, fallback: ThemeMode): ThemeMode {
  try {
    return normalizeTheme(localStorage.getItem(storageKey), fallback)
  } catch {
    return fallback
  }
}

/**
 * 把主题挂到 `<html>` 上 —— 这是唯一真正改变外观的动作。
 *
 * 浅色也会显式写 `data-theme="light"`（而不是删掉属性）：
 * theme-light.css 同时挂了 `:root` 和 `[data-theme='light']`，
 * 两种写法都对，但显式写出来更好排查 —— 一看属性就知道当前是什么主题。
 */
export function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute(THEME_ATTR, mode)
}

/**
 * 写回 localStorage。
 *
 * ⚠️ 写失败**不算错**：隐私模式下会抛异常，但本次会话的主题已经生效了，
 *    只是下次打开会回到默认。为了这个弹个错误提示反而是打扰。
 */
export function persistTheme(storageKey: string, mode: ThemeMode): void {
  try {
    localStorage.setItem(storageKey, mode)
  } catch {
    /* 忽略 —— 见上面的说明 */
  }
}
