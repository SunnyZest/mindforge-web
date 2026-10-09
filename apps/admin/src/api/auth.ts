import type { LoginDTO, LoginVO, UserInfoVO } from '@mindforge/shared'

import { http } from './index'

export const authApi = {
  /**
   * 登录。
   *
   * ⚠️ `skipRefresh` 是必须的：**密码错的时候后端返回的也是 401**。
   * 不跳过的话会被响应拦截器当成「会话过期」去调刷新接口，刷新也失败 →
   * 用户看到的是「登录已过期」而不是「用户名或密码错误」，完全误导。
   */
  login: (dto: LoginDTO) => http.post<LoginVO>('/admin/auth/login', dto, { skipRefresh: true }),

  /** 当前登录用户（含 roles / permissions）—— 刷新页面后靠它恢复状态 */
  me: () => http.get<UserInfoVO>('/admin/auth/me'),

  /** 登出：后端会撤销这个 refreshToken */
  logout: (refreshToken: string) =>
    http.post<void>('/admin/auth/logout', { refreshToken }, { skipRefresh: true }),
}
