import type {
  InterviewAnswerDTO,
  InterviewAnswerResultVO,
  InterviewCreateDTO,
  InterviewDetailVO,
  InterviewQuery,
  InterviewReportVO,
  InterviewVO,
  PageResult,
} from '@mindforge/shared'

import { http } from './index'

/** AI 慢接口的统一超时 —— 出题 / 评分 / 出报告都是模型现跑，几十秒到几分钟 */
const AI_TIMEOUT = 5 * 60 * 1000

/**
 * 用户端模拟面试。
 *
 * ★ **流程是五步，别合成一步**：
 *     创建（快）→ 出题（慢）→ 开始作答（快）→ 逐题提交（慢）→ 结束出报告（慢）
 *
 *   后端刻意拆开的原因：创建失败（参数错）和出题失败（AI 超时）是两类问题，
 *   合成一个接口前端说不清该提示什么；而且出题失败后没法单独重试。
 *
 * ⚠️ 三个慢接口（generate / answer / finish）都要显式放宽超时 ——
 *    默认 30 秒必挂。
 *
 * ⚠️ generate 和 start 是**幂等**的：重复调用不会重复出题 / 重复开始。
 *    所以失败了可以放心重试。
 */
export const interviewApi = {
  page: (query: InterviewQuery) =>
    http.get<PageResult<InterviewVO>>('/app/interviews', { params: query }),

  /** 详情（含题目） */
  detail: (id: string) => http.get<InterviewDetailVO>(`/app/interviews/${id}`),

  /** 创建。**这一步不出题** —— 出题要单独调 generate() */
  create: (dto: InterviewCreateDTO) => http.post<InterviewVO>('/app/interviews', dto),

  /**
   * 出题（慢，幂等）。
   * 返回出好题的详情 —— 直接替换本地状态就行，不用再拉一次。
   */
  generate: (id: string) =>
    http.post<InterviewDetailVO>(`/app/interviews/${id}/generate`, undefined, {
      timeout: AI_TIMEOUT,
    }),

  /** 开始作答（快，幂等）。把状态从 CREATED 推到 IN_PROGRESS */
  start: (id: string) => http.post<InterviewDetailVO>(`/app/interviews/${id}/start`),

  /**
   * 提交单题回答（慢）。
   * ★ 返回值里**自带下一题** —— 不用再拉一次详情，省一个来回。
   */
  answer: (id: string, dto: InterviewAnswerDTO) =>
    http.post<InterviewAnswerResultVO>(`/app/interviews/${id}/answers`, dto, {
      timeout: AI_TIMEOUT,
    }),

  /** 结束面试并生成报告（慢）。返回的就是报告 */
  finish: (id: string) =>
    http.post<InterviewReportVO>(`/app/interviews/${id}/finish`, undefined, {
      timeout: AI_TIMEOUT,
    }),

  /**
   * 取报告。
   * ⚠️ 面试还没结束时会失败（报告不存在），调用方要接住这个错误。
   */
  report: (id: string) => http.get<InterviewReportVO>(`/app/interviews/${id}/report`),

  remove: (id: string) => http.delete<void>(`/app/interviews/${id}`),
}
