import type {
  AiEffectiveConfigVO,
  AiModelCreateDTO,
  AiModelUpdateDTO,
  AiModelVO,
  AiScene,
} from '@mindforge/shared'

import { http } from './index'

/**
 * AI 模型配置。
 *
 * ⚠️ 接口**永远不会返回明文 apiKey** —— 列表里只有 `apiKeyHint`（如 `****abcd`）
 * 和 `hasApiKey`。所以「编辑」时表单里的 Key 输入框必须是**空的**，
 * 提交时也不要把空串发上去（那会把已有的 Key 覆盖掉）。
 * 正确做法：不填就不传这个字段（`apiKey: undefined`），后端保持原值。
 */
export const aiModelApi = {
  /** `scene` 不传 = 返回全部用途的配置 */
  list: (scene?: AiScene) => http.get<AiModelVO[]>('/admin/ai/models', { params: { scene } }),

  /**
   * 当前**真正生效**的配置 —— `list` 答不出的那个问题。
   *
   * ⚠️ 后端在 Python 不可达时**抛 50201**，不会吞成空数组：
   * 「查不到」和「没有任何生效配置」要给的提示完全不同
   * （「先把 AI 服务起起来」vs「去配一个模型」）。
   * 所以这里**不要 catch 成默认值**，让错误冒到页面上。
   */
  effective: () => http.get<AiEffectiveConfigVO>('/admin/ai/models/effective'),

  create: (dto: AiModelCreateDTO) => http.post<AiModelVO>('/admin/ai/models', dto),

  update: (id: string, dto: AiModelUpdateDTO) => http.put<AiModelVO>(`/admin/ai/models/${id}`, dto),

  remove: (id: string) => http.delete<void>(`/admin/ai/models/${id}`),
}
