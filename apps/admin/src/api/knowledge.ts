import type {
  AdminKnowledgeBaseQuery,
  AdminKnowledgeBaseVO,
  PageResult,
} from '@mindforge/shared'

import { http } from './index'

/**
 * 知识库管理（管理端视角）。
 *
 * ⚠️ 管理端**只能看和删**，不能建 —— 建库是用户端的事（`POST /app/knowledge-bases`）。
 * 这里管的是「所有用户的知识库」，所以列表项带 `username` 表示归属人。
 */
export const knowledgeApi = {
  page: (query: AdminKnowledgeBaseQuery) =>
    http.get<PageResult<AdminKnowledgeBaseVO>>('/admin/knowledge-bases', { params: query }),

  detail: (id: string) =>
    http.get<AdminKnowledgeBaseVO>(`/admin/knowledge-bases/${id}`),

  /**
   * 删除知识库。
   * ⚠️ 后端是**软删除**，但底下文档的向量要走异步清理（Python 服务轮询
   * `/internal/documents/pending-vector-purge`），所以删完别立刻断言「向量没了」。
   */
  remove: (id: string) => http.delete<void>(`/admin/knowledge-bases/${id}`),
}
