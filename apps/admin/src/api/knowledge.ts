import type {
  AdminKnowledgeBaseQuery,
  AdminKnowledgeBaseVO,
  KnowledgeBaseCreateDTO,
  KnowledgeBaseUpdateDTO,
  PageResult,
} from '@mindforge/shared'

import { http } from './index'

/**
 * 知识库管理（管理端视角）。
 * 支持查看所有用户知识库、创建官方/管理端知识库、修改与级联删除。
 */
export const knowledgeApi = {
  page: (query: AdminKnowledgeBaseQuery) =>
    http.get<PageResult<AdminKnowledgeBaseVO>>('/admin/knowledge-bases', { params: query }),

  detail: (id: string) => http.get<AdminKnowledgeBaseVO>(`/admin/knowledge-bases/${id}`),

  create: (dto: KnowledgeBaseCreateDTO) =>
    http.post<AdminKnowledgeBaseVO>('/admin/knowledge-bases', dto),

  update: (id: string, dto: KnowledgeBaseUpdateDTO) =>
    http.put<void>(`/admin/knowledge-bases/${id}`, dto),

  /**
   * 删除知识库。
   * ⚠️ 后端是**软删除**，但底下文档的向量要走异步清理（Python 服务轮询
   * `/internal/documents/pending-vector-purge`），所以删完别立刻断言「向量没了」。
   */
  remove: (id: string) => http.delete<void>(`/admin/knowledge-bases/${id}`),
}
