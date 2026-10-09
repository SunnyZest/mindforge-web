import type { AuditLogQuery, AuditLogVO, PageResult } from '@mindforge/shared'

import { http } from './index'

/**
 * 审计日志（只读，没有写接口 —— 日志由后端 AOP 自动记）。
 *
 * ⚠️ 两个字段要注意：
 *   · `userId` 可能为 null（登录失败时还没认到人）
 *   · `detailJson` 是**字符串**不是对象，要用的时候自己 `JSON.parse`，
 *     而且得容错 —— 内容由后端决定，不保证一定合法
 */
export const auditLogApi = {
  page: (query: AuditLogQuery) =>
    http.get<PageResult<AuditLogVO>>('/admin/audit-logs', { params: query }),
}
