import type {
  InvitationExtractDTO,
  InvitationExtractVO,
  JobEventSaveDTO,
  JobEventVO,
} from '@mindforge/shared'

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

  /**
   * 从面试邀约里抽取日程（**不落库**）。
   *
   * ★ 这是**同步慢接口**：后端要先解析文件（PDF / 截图可能走 OCR）再调模型。
   *   实测 1~6 秒（2026-10-29，`ai_usage_record` 里 4 次成功调用平均 3.9 秒、最长 6.0 秒，
   *   输出约 230 token）—— 比简历解析快一个量级，因为输出只有几百 token。
   *
   * ⚠️ **超时不要往下调**。耗时链条是：
   *   Python 单次 55 秒 × (1 + 1 次重试) = 110 秒  <  Java 读超时 115 秒  <  前端 120 秒。
   *   前端必须比 Java 长 —— 否则 Java 还在等、前端先放弃，用户看到「失败」而后端其实成功了
   *   （简历解析那边踩过同样的坑）。要改就三处一起改。
   *
   * ★ 返回的是**候选**，用户确认后才逐条调 `create`。
   *   不要把它当「已创建」处理。
   */
  extractInvitation: (dto: InvitationExtractDTO) =>
    http.post<InvitationExtractVO>('/app/calendar/invitations/extract', dto, {
      timeout: 120 * 1000,
    }),
}
