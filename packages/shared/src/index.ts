/**
 * `@mindforge/shared` 的统一出口。
 *
 * ⚠️ 这里用显式的 `export type` / `export` 而不是 `export *`：
 * 项目开了 `verbatimModuleSyntax`，类型必须用 `export type` 才能保证
 * 编译后不会留下一条指向不存在东西的 import。
 */

// ---------- 类型（后端 VO / DTO 的对应物）----------
export type {
  Result,
  PageResult,
  PageQuery,
  LoginDTO,
  LoginVO,
  TokenVO,
  UserInfoVO,
  UserSummaryVO,
  UserListQuery,
} from './types'

// ---------- HTTP 客户端 ----------
export { createHttp, BizError, HttpError } from './http'
export type { HttpClient, HttpClientOptions } from './http'

// ---------- token 存储 ----------
export { createTokenStore } from './auth'
export type { TokenStore } from './auth'

// ---------- 权限 ----------
export { hasPermission, hasAnyPermission, hasAllPermissions } from './permission'
export type { Permission, AdminPermission, AppPermission } from './permission'
