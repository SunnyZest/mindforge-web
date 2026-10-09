/**
 * 权限码 —— 和后端 `sys_permission.code` 一一对应。
 *
 * ⚠️ <b>为什么要写成联合类型，而不是直接用 string</b>：
 * 权限码是<b>字符串</b>。用 string 的话，写错一个字母不会报错，
 * 只会表现为「这个按钮不出现」或者「菜单少一项」—— 你可能会去查后端权限配置、
 * 查角色绑定，其实只是前端拼错了。写成联合类型，拼错在编译期就报出来。
 *
 * ⚠️ <b>加权限时两边都要改</b>：这里加一个，后端的 sys_permission 也要加。
 * 这个类型只是前端的「已使用清单」，不是权威来源（权威在后端数据库）。
 *
 * ⚠️ <b>前端的权限判断只是 UX，不是安全边界</b>。
 * 隐藏了按钮不等于拦住了请求 —— 后端每个接口都有 @PreAuthorize，那才是真防线。
 */

/** 管理端权限码（对齐 sys_permission 里 `admin:%` 的全部 24 条） */
export type AdminPermission =
  | 'admin:dashboard:read'
  | 'admin:user:list'
  | 'admin:user:detail'
  | 'admin:user:create'
  | 'admin:user:update'
  | 'admin:user:disable'
  | 'admin:user:delete'
  | 'admin:user:assign-role'
  | 'admin:role:list'
  | 'admin:role:create'
  | 'admin:role:update'
  | 'admin:role:delete'
  | 'admin:role:assign-permission'
  | 'admin:permission:list'
  | 'admin:knowledge:list'
  | 'admin:knowledge:delete'
  | 'admin:document:list'
  | 'admin:document:retry'
  | 'admin:document:update'
  | 'admin:document:delete'
  | 'admin:audit:list'
  | 'admin:usage:read'
  | 'admin:ai:manage'
  | 'admin:prompt:manage'

/** 用户端权限码（对齐 sys_permission 里 `app:%` 的全部 23 条） */
export type AppPermission =
  | 'app:knowledge:read'
  | 'app:knowledge:write'
  | 'app:knowledge:delete'
  | 'app:document:read'
  | 'app:document:upload'
  | 'app:document:delete'
  | 'app:document:retry'
  | 'app:conversation:read'
  | 'app:conversation:write'
  | 'app:rag:search'
  | 'app:rag:feedback'
  | 'app:resume:read'
  | 'app:resume:write'
  | 'app:resume:parse'
  | 'app:resume:optimize'
  | 'app:job:read'
  | 'app:job:write'
  | 'app:job:parse'
  | 'app:interview:start'
  | 'app:interview:answer'
  | 'app:interview:report'
  | 'app:interview:read'
  | 'app:interview:write'

export type Permission = AdminPermission | AppPermission

/**
 * 有没有某个权限。
 *
 * @param granted 当前用户的权限码列表（来自 `GET /admin/auth/me` 或登录响应）
 */
export function hasPermission(granted: readonly string[], required: Permission): boolean {
  return granted.includes(required)
}

/** 任一命中即可 —— 用于「这几个权限有一个就能看」的菜单/按钮 */
export function hasAnyPermission(granted: readonly string[], required: readonly Permission[]): boolean {
  return required.some((p) => granted.includes(p))
}

/** 全部命中才可 —— 用于「必须同时具备」的场景，比较少用 */
export function hasAllPermissions(granted: readonly string[], required: readonly Permission[]): boolean {
  return required.every((p) => granted.includes(p))
}
