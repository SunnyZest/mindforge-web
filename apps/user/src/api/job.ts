import type {
  JobCreateDTO,
  JobDetailVO,
  JobQuery,
  JobUpdateDTO,
  JobVO,
  PageResult,
} from '@mindforge/shared'

import { http } from './index'

/**
 * 用户端职位 JD。
 *
 * ⚠️ 解析（`/{id}/parse`）和简历那边**不一样**：
 *    · 简历 —— 异步。调完立刻返回，进度看 `parseStatus`，要轮询。
 *    · 职位 —— **同步**。接口会一直等到模型出结果，然后直接把 JobDetailVO 返回。
 *      后端注释也说了「同步接口，要等模型生成」。
 *   所以这里超时放宽，而且调完直接拿返回的详情，不用再拉一次。
 *   （解析期间 parseStatus 是 PARSING，想轮询也行，但没必要。）
 */
export const jobApi = {
  page: (query: JobQuery) => http.get<PageResult<JobVO>>('/app/jobs', { params: query }),

  detail: (id: string) => http.get<JobDetailVO>(`/app/jobs/${id}`),

  create: (dto: JobCreateDTO) => http.post<JobVO>('/app/jobs', dto),

  /**
   * 修改。
   * ⚠️ 后端是「传了才改」的语义 —— 不传的字段保持原样。
   *    但 `jobDescription` 如果传了空串，会真的把 JD 正文清空。
   */
  update: (id: string, dto: JobUpdateDTO) => http.put<JobVO>(`/app/jobs/${id}`, dto),

  remove: (id: string) => http.delete<void>(`/app/jobs/${id}`),

  /**
   * 触发解析（技能 / 经验 / 学历 / 职责）。
   *
   * ⚠️ **同步慢接口**，要等模型生成完才返回 —— 默认 30 秒超时可能不够，
   *    放宽到 3 分钟。返回的就是解析后的完整详情。
   */
  parse: (id: string) =>
    http.post<JobDetailVO>(`/app/jobs/${id}/parse`, undefined, { timeout: 3 * 60 * 1000 }),
}
