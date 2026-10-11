import { createHttp, createTokenStore } from '@mindforge/shared'

/**
 * token 的 key 前缀。
 *
 * ⚠️⚠️ **必须和管理端区分开**（管理端是 `mf_admin_`）。
 *
 * 两个端上线时是**同源部署**的：nginx 把 `/admin/` 分给管理端，剩下的给用户端。
 * 同源 = **localStorage 共享**。不加前缀的话，你在管理端登录会把用户端的 token
 * 覆盖掉（反过来也一样），表现为「刚登录完切个页面就要重新登录」，
 * 而且只在两个端都开着的时候才复现 —— 很难查。
 */
export const tokenStore = createTokenStore('mf_user_')

/**
 * 会话彻底失效（连刷新都失败了）时的回调。
 *
 * ⚠️ 用「注册」而不是在这里直接跳转：那样 api 层要 import router，
 *    router 要 import store，store 要 import api —— 直接成环。
 */
let sessionExpiredHandler: (() => void) | null = null

export function setSessionExpiredHandler(handler: () => void): void {
  sessionExpiredHandler = handler
}

export const http = createHttp({
  // 开发时 Vite 代理到 :8080，上线由 nginx 代理 —— 默认为 /api，支持通过环境变量定制
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  // ⚠️ 用户端的刷新路径是 /app/auth/refresh，和管理端的 /admin/auth/refresh 不同
  refreshPath: '/app/auth/refresh',
  tokenStore,
  onSessionExpired: () => sessionExpiredHandler?.(),
})
