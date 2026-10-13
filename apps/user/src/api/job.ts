import type {
  JobApplicationStage,
  JobCreateDTO,
  JobCrmUpdateDTO,
  JobDetailVO,
  JobKanbanCardVO,
  JobKanbanColumnVO,
  JobKanbanStatsVO,
  JobQuery,
  JobUpdateDTO,
  JobVO,
  PageResult,
} from '@mindforge/shared'

import { http } from './index'

/**
 * 用户端职位 JD 与求职投递看板 CRM。
 */
export const jobApi = {
  page: (query: JobQuery) => http.get<PageResult<JobVO>>('/app/jobs', { params: query }),

  detail: (id: string) => http.get<JobDetailVO>(`/app/jobs/${id}`),

  create: (dto: JobCreateDTO) => http.post<JobVO>('/app/jobs', dto),

  update: (id: string, dto: JobUpdateDTO) => http.put<JobVO>(`/app/jobs/${id}`, dto),

  remove: (id: string) => http.delete<void>(`/app/jobs/${id}`),

  parse: (id: string) =>
    http.post<JobDetailVO>(`/app/jobs/${id}/parse`, undefined, { timeout: 3 * 60 * 1000 }),

  /** 获取求职看板各阶段卡片列表 */
  kanban: (keyword?: string) =>
    http.get<JobKanbanColumnVO[]>('/app/jobs/kanban', {
      params: keyword ? { keyword } : undefined,
    }),

  /** 获取求职看板顶部统计概览 */
  kanbanStats: () => http.get<JobKanbanStatsVO>('/app/jobs/kanban/stats'),

  /** 快速变更/拖拽投递阶段 */
  updateStage: (id: string, stage: JobApplicationStage) =>
    http.put<JobKanbanCardVO>(`/app/jobs/${id}/stage`, { stage }),

  /** 更新求职 CRM 跟进元信息 */
  updateCrm: (id: string, dto: JobCrmUpdateDTO) =>
    http.put<JobKanbanCardVO>(`/app/jobs/${id}/crm`, dto),
}
