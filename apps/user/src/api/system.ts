import type { AiStatusVO } from '@mindforge/shared'

import { http } from './index'

/**
 * 应用级状态。
 *
 * ★ 这个模块只放「整个应用的状态」，不放业务数据 —— 目前只有 AI 能力状态。
 */
export const systemApi = {
  /**
   * AI 能力状态（首页状态徽章用）。
   *
   * ⚠️ 后端只返回 `READY / DEGRADED / OFFLINE`，**不含模型名** ——
   * 前端不要试图展示具体模型：模型会换、会降级，写死反而稳定。
   *
   * ⚠️ 这个请求失败**不能影响首页渲染**，调用方要自己兜住（按「状态未知」处理）。
   */
  aiStatus: () => http.get<AiStatusVO>('/app/ai/status'),
}
