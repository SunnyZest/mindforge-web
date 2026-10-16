import type { JobEventSaveDTO, JobEventVO } from '@mindforge/shared'

import { http } from './index'

/**
 * 用户端面试日历（求职日程）。
 *
 * ★ 权限复用 `app:job:read` / `app:job:write` —— 日程是职位的子资源
 * （每条日程必挂一个职位），后端没为它单开权限码。
 */
export const calendarApi = {
  /**
   * 按时间范围查日程。不传范围 → 后端返回**当前月**。
   *
   * ⚠️ 跨度上限 366 天（后端 40001 兜底）—— 日历一次只看一个月，
   * 给一年已经非常宽松，再大就是拿接口当全量导出用了。
   */
  list: (params: { from?: string; to?: string } = {}) =>
    http.get<JobEventVO[]>('/app/calendar/events', { params }),

  create: (dto: JobEventSaveDTO) => http.post<JobEventVO>('/app/calendar/events', dto),

  /**
   * 修改 —— **整体覆盖**，不是局部更新。
   *
   * ⚠️ 和 Offer 那边不一样：这里要把完整字段传回来（含 status），
   * 否则会把状态重置成 PENDING。改状态也是走这个接口。
   */
  update: (id: string, dto: JobEventSaveDTO) =>
    http.put<JobEventVO>(`/app/calendar/events/${id}`, dto),

  remove: (id: string) => http.delete<void>(`/app/calendar/events/${id}`),
}
