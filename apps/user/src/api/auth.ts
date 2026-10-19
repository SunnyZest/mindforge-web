import type {
  ChangePasswordDTO,
  LoginDTO,
  LoginVO,
  RegisterDTO,
  ResetPasswordDTO,
  SendVerificationCodeDTO,
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

  /**
   * 发送邮箱验证码。
   *
   * ⚠️ 这个接口是公开的，服务端有三层闸门：60 秒冷却、每日 10 条、最多试错 5 次。
   *    前端**必须**做 60 秒倒计时 —— 不做的话用户连点几次就撞 42904，
   *    看起来像「点了没反应」。
   */
  sendVerificationCode: (dto: SendVerificationCodeDTO) =>
    http.post<void>('/app/auth/verification-code', dto, { skipRefresh: true }),

  /**
   * 找回密码（未登录）。
   *
   * ⚠️ 邮箱没注册过也返回成功 —— 后端刻意这样，避免这个接口被拿来探测
   *    「某个邮箱有没有注册」。所以前端别提示「该邮箱不存在」。
   */
  resetPassword: (dto: ResetPasswordDTO) =>
    http.post<void>('/app/auth/reset-password', dto, { skipRefresh: true }),

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

  /**
   * 上传头像（multipart/form-data，字段名固定为 `file`）。
   *
   * ⚠️ 不要手动设 `Content-Type`：axios 会按 FormData 自动补上带 boundary 的头。
   *    自己写成 `multipart/form-data` 反而会丢掉 boundary，后端解析直接报错。
   *
   * 返回的是**最新的完整资料**，调用方拿它刷新页面即可，不用再 GET 一次。
   */
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return http.post<UserProfileVO>('/app/user/avatar', form)
  },
}
