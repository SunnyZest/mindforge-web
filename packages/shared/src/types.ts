/**
 * 后端接口的类型定义 —— 照着 Java 侧的 VO 抄过来的。
 *
 * ⚠️ 后端【没有】配置 Jackson 的 NON_NULL，所以 null 字段会照样出现在 JSON 里
 * （实测响应里有 `"createdAt":null`）。所以这里用 `string | null` 而不是可选属性 `?` ——
 * 两者含义不同：`?` 是「字段可能不存在」，`| null` 是「字段在，但值是 null」。
 * 写错了前端会出现 `undefined` 和 `null` 两套判断，很烦。
 */

/** 所有接口的统一信封（Java 的 `Result<T>`） */
export interface Result<T> {
  /** 0 = 成功；非 0 见 Java 的 ErrorCode */
  code: number
  message: string
  data: T
  /** 后端日志的追踪 id —— 出问题时把它报给运维能直接定位到那条日志 */
  traceId?: string
}

/** 分页结果（Java 的 `PageResultVO<T>`） */
export interface PageResult<T> {
  page: number
  pageSize: number
  total: number
  records: T[]
}

/** 分页查询的公共参数 */
export interface PageQuery {
  page?: number
  pageSize?: number
  /** 关键词，各模块的匹配字段不同（用户是用户名/昵称，简历是名称/目标职位…） */
  keyword?: string
}

/** 当前登录用户（Java 的 `UserInfoVO`） */
export interface UserInfoVO {
  id: string
  username: string
  nickname: string | null
  /** 角色 code，如 SUPER_ADMIN / ADMIN / USER */
  roles: string[]
  /** 权限码，如 admin:user:list —— 前端拿它决定菜单和按钮显不显示 */
  permissions: string[]
}

/** 登录返回（Java 的 `LoginVO`） */
export interface LoginVO {
  accessToken: string
  refreshToken: string
  /** accessToken 有效期（秒）。后端现在是 30 分钟 —— 刻意设短，靠刷新续期 */
  expiresIn: number
  user: UserInfoVO
}

/** 刷新 token 返回（Java 的 `TokenVO`） */
export interface TokenVO {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginDTO {
  username: string
  password: string
}

/** 用户列表行（Java 的 `UserSummaryVO`） */
export interface UserSummaryVO {
  id: string
  username: string
  nickname: string | null
  email: string | null
  phone: string | null
  avatarUrl: string | null
  /** 1 启用 / 0 禁用 */
  status: number
  roles: string[]
  lastLoginAt: string | null
  createdAt: string | null
}

/** 用户列表的查询参数（比通用分页多两个筛选） */
export interface UserListQuery extends PageQuery {
  /** 1 启用 / 0 禁用；不传 = 全部 */
  status?: number
  /** 角色 code；不传 = 全部 */
  role?: string
}
