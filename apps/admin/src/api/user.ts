import type {
  AdminUserCreateDTO,
  AdminUserDetailVO,
  AssignRolesDTO,
  PageResult,
  UserInfoVO,
  UserListQuery,
  UserStatusDTO,
  UserSummaryVO,
  UserUpdateDTO,
} from '@mindforge/shared'

import { http } from './index'

export const userApi = {
  /**
   * 用户列表（分页 + 筛选）。
   *
   * 参数里值为 `undefined` 的项 axios 会直接不拼进 query string ——
   * 所以 `keyword: ''` 和 `keyword: undefined` 不一样：前者会拼 `keyword=`，
   * 后者表示「不筛」。调用时记得把空串转成 undefined。
   */
  page: (query: UserListQuery) =>
    http.get<PageResult<UserSummaryVO>>('/admin/users', { params: query }),

  /**
   * 用户详情。
   *
   * ⚠️ 返回的是 `AdminUserDetailVO`，**不是** `UserInfoVO` —— 它比列表行多
   * 角色明细（带角色名）、有效权限、登录失败计数 / 锁定剩余、资源与存储占用。
   * 用户端那个 `UserInfoVO` 被 `/app/auth/me` 复用，后端刻意没往里面塞管理端字段。
   */
  detail: (id: string) => http.get<AdminUserDetailVO>(`/admin/users/${id}`),

  create: (dto: AdminUserCreateDTO) => http.post<UserInfoVO>('/admin/users', dto),

  update: (id: string, dto: UserUpdateDTO) => http.put<void>(`/admin/users/${id}`, dto),

  /** 启用 / 禁用 */
  updateStatus: (id: string, dto: UserStatusDTO) =>
    http.put<void>(`/admin/users/${id}/status`, dto),

  /**
   * 分配角色。
   * ⚠️ `roleIds` 传空数组 = 清空该用户所有角色（不是「不改」）。
   */
  assignRoles: (id: string, dto: AssignRolesDTO) => http.put<void>(`/admin/users/${id}/roles`, dto),

  /**
   * 删除用户。
   *
   * ⚠️ 后端**强制要求二次确认凭据**（`X-Confirm-Token` / `X-Confirm-Password`），
   * 不传会返回 `CONFIRM_REQUIRED`。用 `useSecondaryConfirm()` 拿到 token 再传进来。
   */
  remove: (id: string, confirmToken?: string) =>
    http.delete<void>(`/admin/users/${id}`, confirmToken ? { headers: { 'X-Confirm-Token': confirmToken } } : undefined),

  /** 批量启用 / 禁用 */
  batchUpdateStatus: (dto: { ids: (string | number)[]; status: number }) =>
    http.put<number>('/admin/users/batch-status', dto),

  /** 批量分配角色 */
  batchAssignRoles: (dto: { ids: (string | number)[]; roleIds: (string | number)[] }) =>
    http.put<number>('/admin/users/batch-roles', dto),

  /**
   * 批量删除。
   *
   * ⚠️ 同为高危操作、**强制要有二次确认凭据**（理由见 {@link remove}）。
   */
  batchRemove: (dto: { ids: (string | number)[] }, confirmToken?: string) =>
    http.delete<number>('/admin/users/batch', {
      data: dto,
      ...(confirmToken ? { headers: { 'X-Confirm-Token': confirmToken } } : {}),
    }),
}
