import { createHttp, createTokenStore } from '@mindforge/shared'

/**
 * token 的 key 前缀。
 *
 * ⚠️ 必须和用户端区分开 —— 两个端如果同源部署（nginx 按 `/admin/` 分流），
 * localStorage 是<b>共享</b>的。不加前缀的话，管理端登录会把用户端的 token 覆盖掉。
 */
export const tokenStore = createTokenStore('mf_admin_')

/**
 * 会话彻底失效（连刷新都失败了）时的回调。
 *
 * ⚠️ 用「注册」而不是直接在下面写跳转逻辑：那样 api 层要 import router，
 * 而 router 要 import store、store 要 import api —— 直接成环。
 * 让 router 反过来注册，依赖是单向的。
 */
let sessionExpiredHandler: (() => void) | null = null

export function setSessionExpiredHandler(handler: () => void): void {
  sessionExpiredHandler = handler
}

export const http = createHttp({
  // 开发时由 Vite 代理到 :8080，上线由 nginx 代理 —— 两边都是 /api，前端不用改
  baseURL: '/api',
  refreshPath: '/admin/auth/refresh',
  tokenStore,
  onSessionExpired: () => sessionExpiredHandler?.(),
})
