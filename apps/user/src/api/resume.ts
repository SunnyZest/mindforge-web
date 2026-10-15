import type {
  AtsScoreVO,
  PageResult,
  ResumeDetailVO,
  ResumeJobAnalysisDTO,
  ResumeJobAnalysisQuery,
  ResumeJobAnalysisVO,
  ResumeOptimizeDTO,
  ResumeOptimizeVO,
  ResumeParsedVO,
  ResumeQuery,
  ResumeUpdateDTO,
  ResumeVO,
} from '@mindforge/shared'

import { http } from './index'

/**
 * 用户端简历。
 *
 * ⚠️ 上传是 **multipart/form-data**（`@RequestPart("file")`），
 *    但后端的 OpenAPI 注解写的是 application/json —— 注解是错的，
 *    以 Java 源码 `ResumeController.upload()` 为准。
 *    `name` / `targetPosition` 是 `@RequestParam`，走 query string。
 */
export const resumeApi = {
  page: (query: ResumeQuery) => http.get<PageResult<ResumeVO>>('/app/resumes', { params: query }),

  detail: (id: string) => http.get<ResumeDetailVO>(`/app/resumes/${id}`),

  /**
   * 解析结果。
   *
   * ★ 轮询解析进度用这个而不是 detail —— 响应体小得多，适合高频调用
   *   （后端在 `ResumeParsedVO` 的注释里也这么建议）。
   */
  parsed: (id: string) => http.get<ResumeParsedVO>(`/app/resumes/${id}/parsed`),

  /**
   * 上传。
   *
   * 允许的扩展名：pdf / docx / txt / md / markdown / html / htm
   * （Java `UploadConstants.RESUME_EXT`）。前端先挡一道，给个明确的提示，
   * 别等后端返回 FILE_TYPE_UNSUPPORTED。
   *
   * ⚠️ 上传只把文件存下来，**不会自动解析** —— 解析要单独调 `parse()`。
   *    后端是刻意拆开的：解析是几十秒的慢接口，塞进上传会让「上传」变得不可预期。
   */
  upload: (file: File, extra: { name?: string; targetPosition?: string } = {}) => {
    const form = new FormData()
    form.append('file', file)
    return http.post<ResumeVO>('/app/resumes', form, {
      // 空串要转 undefined，否则会拼出 `?name=` 这种空参数
      params: {
        name: extra.name?.trim() || undefined,
        targetPosition: extra.targetPosition?.trim() || undefined,
      },
    })
  },

  /**
   * 触发解析。
   *
   * ★ 这是个**慢接口**（几十秒），但它是异步的：调完立刻返回，
   *   实际进度去看 `parseStatus`（PENDING → PARSING → SUCCESS / FAILED）。
   *   所以超时不用放宽，调完开始轮询就行。
   */
  parse: (id: string) => http.post<void>(`/app/resumes/${id}/parse`),

  /** 在线精修或采纳 AI 改写建议后保存简历内容 */
  update: (id: string, dto: ResumeUpdateDTO) =>
    http.put<ResumeDetailVO>(`/app/resumes/${id}`, dto),

  remove: (id: string) => http.delete<void>(`/app/resumes/${id}`),

  /**
   * AI 优化建议。
   *
   * ⚠️⚠️ **同步慢接口，实测 100~120 秒**（后端优化过一轮：建议条数上限
   *      从 8 收到 5、字段加了字数上限，才从 203/360 秒降下来）。
   *      默认 30 秒超时必然失败，所以这里显式放宽到 5 分钟。
   *
   * ⚠️ 前置条件：简历必须**已解析过**，否则返回 40001。
   *    页面上应该在 `structuredJson` 为空时把按钮置灰并说明原因。
   *
   * ⚠️ 这个接口**不落库、不改简历** —— 只返回建议，可以反复调，没有副作用。
   */
  optimize: (id: string, dto: ResumeOptimizeDTO = {}) =>
    http.post<ResumeOptimizeVO>(`/app/resumes/${id}/optimize`, dto, {
      timeout: 5 * 60 * 1000,
    }),

  /**
   * 简历与目标职位匹配分析。
   *
   * ⚠️⚠️ **慢接口，实测 100~200 秒**，超时放宽到 5 分钟。
   *      落库存储，重复调用会覆盖同一条记录。
   *      权限 app:resume:match
   */
  match: (dto: ResumeJobAnalysisDTO) =>
    http.post<ResumeJobAnalysisVO>('/app/resume-job-analysis', dto, {
      timeout: 5 * 60 * 1000,
    }),

  /**
   * 查询已有的匹配分析结果。
   * 快接口（不调模型），若尚未匹配过则返回 40413。
   * 权限 app:resume:read
   */
  getMatch: (query: ResumeJobAnalysisQuery) =>
    http.get<ResumeJobAnalysisVO>('/app/resume-job-analysis', { params: query }),

  /**
   * ATS 关键词跑分：JD 里的关键词在简历里出现了没有。
   *
   * ★ 纯**本地算法**：不调模型、毫秒级、0 token、同一输入永远同一分。
   *   和 `match()`（匹配分析）是两回事 —— 那个是「能力够不够」的人的视角，
   *   这个是「机器筛简历」的视角。页面上两个入口分开，别混成一句话说。
   *
   * 失败分支：
   *   40001 该职位还没解析出技能项（提示先解析 JD）
   *   40409 简历不存在或不是你的
   */
  atsScore: (id: string, jobId: string) =>
    http.get<AtsScoreVO>(`/app/resumes/${id}/ats-score`, { params: { jobId } }),
}

