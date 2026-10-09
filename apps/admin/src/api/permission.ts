import type { PermissionVO } from '@mindforge/shared'

import { http } from './index'

/**
 * 权限字典。
 *
 * 权限是**后端定义好的**（`sys_permission` 表），前端只能读不能写 ——
 * 所以这里只有 listAll 一个方法。
 */
export const permissionApi = {
  /**
   * 全部权限（47 条：管理端 24 + 用户端 23）。
   *
   * 用途：给角色分配权限时做「全集」，和 roleApi.listPermissions() 求交集
   * 得出哪些该勾上。
   */
  listAll: () => http.get<PermissionVO[]>('/admin/permissions'),
}
