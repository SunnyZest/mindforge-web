import type { UsageByModelVO, UsageDailyVO, UsageQuery, UsageSummaryVO } from '@mindforge/shared'

import { http } from './index'

/**
 * AI 使用量。
 *
 * ★ 三个接口共用同一套日期参数（`from` / `to`，ISO 日期 `yyyy-MM-dd`，都可空）——
 *   前端切时间范围时，三个请求一起改就行。
 *
 * ⚠️ 日期不传 = 后端自己定范围（不限制），不是「今天」。
 *    所以界面上应该有个明确的范围选择，别让用户以为看到的是全部。
 */
export const usageApi = {
  /** 总览：请求数 / 成功失败 / token / 平均耗时 */
  summary: (query: UsageQuery = {}) => http.get<UsageSummaryVO>('/admin/usage', { params: query }),

  /**
   * 按天汇总 —— 画趋势图用。
   * ⚠️ **只返回有记录的天**，没有请求的日子不会出现在数组里。
   *    画图时要自己补零，否则 X 轴会把稀疏的日子挤在一起。
   */
  daily: (query: UsageQuery = {}) =>
    http.get<UsageDailyVO[]>('/admin/usage/daily', { params: query }),

  /** 按「场景 + 模型」汇总 —— 回答「钱花在哪个场景、哪个模型上」 */
  byModel: (query: UsageQuery = {}) =>
    http.get<UsageByModelVO[]>('/admin/usage/models', { params: query }),
}
