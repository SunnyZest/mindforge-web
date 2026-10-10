import type {
  ChangePasswordDTO,
  LoginDTO,
  LoginVO,
  RegisterDTO,
  UserInfoVO,
  UserProfileUpdateDTO,
  UserProfileVO,
} from '@mindforge/shared'

import { http } from './index'

/**
 * 用户端认证 / 个人资料。
 *
 * ⚠️ 路径全是 `/app/...`，不是管理端的 `/admin/...` ——
 *    两端的登录接口是**独立的**，token 也不通用（后端按端区分）。
 */
export const authApi = {
  /**
   * 登录。
   *
   * ⚠️ `skipRefresh` 是必须的：**密码错的时候后端返回的也是 401**。
   *    不跳过的话会被响应拦截器当成「会话过期」去刷新，
   *    用户看到的是「登录已过期」而不是「用户名或密码错误」，完全误导。
   */
  login: (dto: LoginDTO) => http.post<LoginVO>('/app/auth/login', dto, { skipRefresh: true }),

  /** 注册。注册完不会自动登录 —— 后端只返回结果，要再调一次 login */
  register: (dto: RegisterDTO) => http.post<void>('/app/auth/register', dto, { skipRefresh: true }),

  /** 当前登录用户（含 roles / permissions）—— 刷新页面后靠它恢复状态 */
  me: () => http.get<UserInfoVO>('/app/auth/me'),

  /** 登出：后端会撤销这个 refreshToken */
  logout: (refreshToken: string) =>
    http.post<void>('/app/auth/logout', { refreshToken }, { skipRefresh: true }),

  /** 修改密码。改完 refreshToken 通常会失效，调用方记得处理 */
  changePassword: (dto: ChangePasswordDTO) => http.post<void>('/app/auth/password', dto),
}

/** 个人资料 */
export const profileApi = {
  get: () => http.get<UserProfileVO>('/app/user/profile'),
  update: (dto: UserProfileUpdateDTO) => http.put<UserProfileVO>('/app/user/profile', dto),
}
