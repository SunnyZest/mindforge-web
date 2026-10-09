import type { TokenVO } from './types'

/**
 * token 的本地存储。
 *
 * ⚠️ <b>为什么用 localStorage 而不是 httpOnly Cookie</b>：
 * 后端的 token 是放在<b>响应体</b>里返回的（`LoginVO` 有 accessToken / refreshToken 字段），
 * 前端必须自己存。代价是 XSS 能读到 token —— 所以真正要紧的是别把用户输入直接塞 innerHTML。
 * 要做成 Cookie 得先改后端（Set-Cookie + CSRF 防护），那是另一个话题。
 */
export interface TokenStore {
  getAccess(): string | null
  getRefresh(): string | null
  save(tokens: TokenVO): void
  clear(): void
}

/**
 * 建一个带前缀的 token 存储。
 *
 * ⚠️ <b>为什么要前缀</b>：两个前端如果部署在<b>同一个源</b>（nginx 按 `/admin/` 分流），
 * localStorage 是<b>共享</b>的 —— 不加前缀的话，管理端登录会把用户端的 token 覆盖掉，
 * 反过来也一样。各自一个前缀，互不干扰。
 *
 * 代价是「同一个人用两个端要登录两次」。这其实是想要的 ——
 * 管理端的登录态不该顺带把用户端也登进去。
 */
export function createTokenStore(prefix: string): TokenStore {
  const ACCESS_KEY = `${prefix}access_token`
  const REFRESH_KEY = `${prefix}refresh_token`

  return {
    getAccess: () => localStorage.getItem(ACCESS_KEY),
    getRefresh: () => localStorage.getItem(REFRESH_KEY),

    save(tokens: TokenVO): void {
      localStorage.setItem(ACCESS_KEY, tokens.accessToken)
      localStorage.setItem(REFRESH_KEY, tokens.refreshToken)
    },

    clear(): void {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
    },
  }
}
