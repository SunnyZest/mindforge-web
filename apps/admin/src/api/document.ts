import type {
  AdminDocumentQuery,
  AdminDocumentVO,
  ChunkVO,
  DocumentStatusUpdateDTO,
  PageQuery,
  PageResult,
} from '@mindforge/shared'

import { http } from './index'

/**
 * 文档与分块（管理端视角）。
 *
 * ⚠️ 文档有三段独立状态：parseStatus / chunkStatus / vectorStatus。
 * 它们由后端 + Python AI 服务分别推进，**可能一段失败另一段还在跑**。
 * 列表里的 `status` 是后端聚合出来的总状态，展示进度时优先用它；
 * 要看「卡在哪一步」再用三个分状态。
 */
export const documentApi = {
  page: (query: AdminDocumentQuery) =>
    http.get<PageResult<AdminDocumentVO>>('/admin/documents', { params: query }),

  detail: (id: string) => http.get<AdminDocumentVO>(`/admin/documents/${id}`),

  /**
   * 手动改状态。
   * 主要用途是**人工纠错**（比如 AI 服务挂了导致一直 PENDING）。
   * `errorMessage` 传空串是「清空」、传 undefined 是「不改」—— 语义不同。
   */
  updateStatus: (id: string, dto: DocumentStatusUpdateDTO) =>
    http.put<void>(`/admin/documents/${id}/status`, dto),

  /** 重新走一遍解析流水线 */
  retry: (id: string) => http.post<void>(`/admin/documents/${id}/retry`),

  remove: (id: string) => http.delete<void>(`/admin/documents/${id}`),

  /** 批量重试解析流水线 */
  batchRetry: (dto: { ids: (string | number)[] }) =>
    http.post<number>('/admin/documents/batch-retry', dto),

  /** 批量删除文档 */
  batchRemove: (dto: { ids: (string | number)[] }) =>
    http.delete<number>('/admin/documents/batch', { data: dto }),

  /**
   * 文档的分块列表。
   *
   * 用途：排查「为什么 RAG 没召回到」—— 看正文有没有被正确切分。
   * `documentName` 字段是为**引用溯源**准备的（回答里标「来自哪个文档」）。
   */
  chunks: (id: string, query?: PageQuery) =>
    http.get<PageResult<ChunkVO>>(`/admin/documents/${id}/chunks`, { params: query }),
}
