import type { DashboardVO } from '@mindforge/shared'

import { http } from './index'

/**
 * 仪表盘统计。
 *
 * ⚠️ 返回的是一堆**平铺的计数**，不是时间序列 —— 想做折线图得后端再加接口。
 * 各项都不含已删除数据（后端在 SQL 里就过滤了）。
 */
export const dashboardApi = {
  stats: () => http.get<DashboardVO>('/admin/dashboard'),
}
