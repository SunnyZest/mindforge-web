import type {
  AdminUserCreateDTO,
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

  /** 用户详情（返回的是 UserInfoVO，含 permissions） */
  detail: (id: string) => http.get<UserInfoVO>(`/admin/users/${id}`),

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

  remove: (id: string) => http.delete<void>(`/admin/users/${id}`),
}
