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
 * ⚠️⚠️ <b>这份清单已经漏过两次了</b>（`c8de220` 补了 3 个面试码，
 * 2026-10-10 补了 `app:resume:match`）—— 后端加了权限码，前端忘了同步。
 * 后果不致命（运行时 `permissions.includes()` 照样能匹配），但你在前端写
 * `auth.can('app:resume:match')` 会直接编译不过，查半天不知道为什么。
 *
 * <b>核对办法</b>：起后端，登录拿 token，比对 code 集合：
 * ```bash
 * curl -s -X POST localhost:8080/api/admin/auth/login \
 *   -H 'Content-Type: application/json' \
 *   -d '{"username":"admin","password":"admin123"}'   # 取 data.accessToken
 * curl -s localhost:8080/api/admin/permissions -H "Authorization: Bearer <token>"
 * ```
 * 和后端 `GET /admin/permissions` 返回的 code 集合应该**完全一致**。
 *
 * ⚠️ <b>前端的权限判断只是 UX，不是安全边界</b>。
 * 隐藏了按钮不等于拦住了请求 —— 后端每个接口都有 @PreAuthorize，那才是真防线。
 */

/** 管理端权限码（对齐 sys_permission 里 `admin:%` 的全部 25 条） */
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
  | 'admin:alert:list'

/** 用户端权限码（对齐 sys_permission 里 `app:%` 的全部 25 条） */
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
  /** 读可选的提示词变体（用户端问答时挑风格用） */
  | 'app:prompt:read'
  | 'app:resume:read'
  | 'app:resume:write'
  | 'app:resume:parse'
  | 'app:resume:optimize'
  | 'app:resume:match'
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
  if (granted.includes('*') || granted.includes('*:*:*')) {
    return true
  }
  return granted.includes(required)
}

/** 任一命中即可 —— 用于「这几个权限有一个就能看」的菜单/按钮 */
export function hasAnyPermission(
  granted: readonly string[],
  required: readonly Permission[],
): boolean {
  if (granted.includes('*') || granted.includes('*:*:*')) {
    return true
  }
  return required.some((p) => granted.includes(p))
}

/** 全部命中才可 —— 用于「必须同时具备」的场景，比较少用 */
export function hasAllPermissions(
  granted: readonly string[],
  required: readonly Permission[],
): boolean {
  if (granted.includes('*') || granted.includes('*:*:*')) {
    return true
  }
  return required.every((p) => granted.includes(p))
}
