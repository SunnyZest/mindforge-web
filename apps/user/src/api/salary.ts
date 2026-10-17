import type {
  PageResult,
  SalaryEstimateDTO,
  SalaryEstimateVO,
} from '@mindforge/shared'

import { http } from './index'

/**
 * 用户端薪酬估算（AI 参考区间）。
 *
 * ★ 这不是「市场行情」查询：后端没有真实薪酬样本，
 * 结果里一定带 `caveat`（免责声明）与 `confidence`（置信度），
 * 页面必须原样展示，不能为了好看把提示藏起来。
 *
 * ⚠️ 估算是慢接口（十几秒到一分钟），且同参数 7 天内会直接返回缓存
 * （`cached=true`）—— 用户连续点两次不会重复烧 token，但界面要给出提示，
 * 否则他会以为结果为什么一模一样。
 */
export const salaryApi = {
  /** 发起估算。参数不变时后端直接复用 7 天内的结果 */
  estimate: (dto: SalaryEstimateDTO) =>
    http.post<SalaryEstimateVO>('/app/salary/estimate', dto),

  /** 估算历史（分页，按时间倒序） */
  history: (query: { page?: number; pageSize?: number } = {}) =>
    http.get<PageResult<SalaryEstimateVO>>('/app/salary/estimates', { params: query }),
}
