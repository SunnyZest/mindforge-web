import type {
  ChunkVO,
  DocumentStatusVO,
  DocumentVO,
  KnowledgeBaseCreateDTO,
  KnowledgeBaseStatsVO,
  KnowledgeBaseUpdateDTO,
  KnowledgeBaseVO,
  PageQuery,
  PageResult,
} from '@mindforge/shared'

import { http } from './index'

/**
 * 用户端知识库与文档。
 *
 * ⚠️ 文档上传是 **multipart/form-data**（`@RequestPart("file")`），
 *    `description` 是 `@RequestParam`，走 query string。
 *    允许的扩展名：pdf / docx / txt / md / markdown / html / htm
 *    （Java `UploadConstants.DOCUMENT_EXT`）。
 *
 * ⚠️ 上传 ≠ 处理完：上传后文档会走「解析 → 分块 → 向量」三步流水线，
 *    由后端异步跑。进度看 `status` 和三个子状态，**要轮询**。
 */
export const knowledgeApi = {
  page: (query: PageQuery) =>
    http.get<PageResult<KnowledgeBaseVO>>('/app/knowledge-bases', { params: query }),

  detail: (id: string) => http.get<KnowledgeBaseVO>(`/app/knowledge-bases/${id}`),

  create: (dto: KnowledgeBaseCreateDTO) => http.post<KnowledgeBaseVO>('/app/knowledge-bases', dto),

  /** 修改 —— 后端是「传了才改」的语义 */
  update: (id: string, dto: KnowledgeBaseUpdateDTO) =>
    http.put<void>(`/app/knowledge-bases/${id}`, dto),

  /** 删除 —— ⚠️ 会级联删掉这个库下面的文档和对话，界面上要二次确认 */
  remove: (id: string) => http.delete<void>(`/app/knowledge-bases/${id}`),

  /** 统计：文档数 / 分块数 / 已完成 / 失败 */
  stats: (id: string) => http.get<KnowledgeBaseStatsVO>(`/app/knowledge-bases/${id}/stats`),

  // ---------- 库下面的文档 ----------
  documents: (kbId: string, query: PageQuery) =>
    http.get<PageResult<DocumentVO>>(`/app/knowledge-bases/${kbId}/documents`, { params: query }),

  uploadDocument: (kbId: string, file: File, description?: string) => {
    const form = new FormData()
    form.append('file', file)
    return http.post<DocumentVO>(`/app/knowledge-bases/${kbId}/documents`, form, {
      params: { description: description?.trim() || undefined },
    })
  },
}

/** 文档操作（不挂在知识库下面） */
export const documentApi = {
  detail: (id: string) => http.get<DocumentVO>(`/app/documents/${id}`),

  /**
   * 处理状态。
   * ★ 轮询用这个 —— 响应体比 detail 小，适合高频调用。
   */
  status: (id: string) => http.get<DocumentStatusVO>(`/app/documents/${id}/status`),

  /** 重试处理失败的文档。恢复性操作，不用二次确认 */
  retry: (id: string) => http.post<void>(`/app/documents/${id}/retry`),

  /** 删除文档 */
  remove: (id: string) => http.delete<void>(`/app/documents/${id}`),

  /*
   * ⚠️ 这里原本有个 `downloadUrl: (id) => \`/api/app/documents/${id}/download\``，
   *    已经删掉，**不要再加回来**。
   *
   *    那个接口要认证，而前端只能 `window.open` 让浏览器导航 —— 导航带不上
   *    `Authorization`，结果就是用户点下载看到一页 401 JSON（还带 traceId）。
   *    也不能用 axios 跟它的 302：OSS bucket 没配 CORS，跨域拿不到内容。
   *
   *    正确做法：先 `detail(id)` 拿 `downloadUrl`（预签名地址，自带签名），
   *    再导航过去。见 `KnowledgeDetailView` 的 `onDownload()`。
   */
}

/** 分块 —— 对话里点「引用」看原文用 */
export const chunkApi = {
  detail: (id: string) => http.get<ChunkVO>(`/app/chunks/${id}`),
}
