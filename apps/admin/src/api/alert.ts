import type { AdminAlertQuery, AdminAlertVO, PageResult } from '@mindforge/shared'

import { http } from './index'

/**
 * 管理端高危操作告警。
 *
 * ⚠️ 告警不提供删除接口（对齐审计日志：能删的告警没有留痕意义）。
 * 已读即为生命周期的终点。
 */
export const alertApi = {
  /** 告警分页列表（支持按未读过滤、排序） */
  page: (query: AdminAlertQuery = {}) =>
    http.get<PageResult<AdminAlertVO>>('/admin/alerts', { params: query }),

  /** 未读告警数量（顶栏铃铛角标用） */
  unreadCount: () => http.get<number>('/admin/alerts/unread-count'),

  /** 标记单条已读（幂等操作） */
  markRead: (id: string) => http.put<void>(`/admin/alerts/${id}/read`),

  /** 全部标记已读，返回本次标记的条数 */
  markAllRead: () => http.put<number>('/admin/alerts/read-all'),
}
