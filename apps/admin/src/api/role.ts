import type {
  AssignPermissionsDTO,
  RoleCreateDTO,
  RoleUpdateDTO,
  RoleVO,
  PermissionVO,
} from '@mindforge/shared'

import { http } from './index'

/**
 * 角色管理。
 *
 * ⚠️ `list()` 返回的是**数组不是分页** —— 角色总量很少（个位数），
 * 后端没做分页。别照着用户列表那套写。
 */
export const roleApi = {
  list: () => http.get<RoleVO[]>('/admin/roles'),

  create: (dto: RoleCreateDTO) => http.post<RoleVO>('/admin/roles', dto),

  update: (id: string, dto: RoleUpdateDTO) => http.put<void>(`/admin/roles/${id}`, dto),

  /**
   * 删除角色。
   * ⚠️ 内置角色（`RoleVO.builtin === true`）后端会拒绝 —— 前端应该先把按钮禁掉，
   * 别等用户点了才报错。
   * ⚠️ 且**强制要求二次确认凭据**（`X-Confirm-Token`）：不传会返回 `CONFIRM_REQUIRED`。
   * 用 `useSecondaryConfirm()` 拿到 token 再传进来。
   */
  remove: (id: string, confirmToken?: string) =>
    http.delete<void>(`/admin/roles/${id}`, confirmToken ? { headers: { 'X-Confirm-Token': confirmToken } } : undefined),

  /**
   * 该角色**已绑定**的权限（不是全部权限）。
   *
   * 做权限勾选界面时要两个接口配合：
   *   全集 = permissionApi.listAll()
   *   已选 = roleApi.listPermissions(id)
   * 然后按 id 求交集 —— 别指望这个接口返回带 `checked` 标记的全集。
   */
  listPermissions: (id: string) => http.get<PermissionVO[]>(`/admin/roles/${id}/permissions`),

  /** 分配权限。⚠️ 传空数组 = 清空该角色所有权限（不是「不改」） */
  assignPermissions: (id: string, dto: AssignPermissionsDTO) =>
    http.put<void>(`/admin/roles/${id}/permissions`, dto),
}
