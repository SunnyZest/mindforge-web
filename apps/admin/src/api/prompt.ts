import type { PromptCreateDTO, PromptGroupVO, PromptUpdateDTO, PromptVO } from '@mindforge/shared'

import { http } from './index'

/**
 * 提示词管理。
 *
 * ★ 结构是「**变体 → 版本**」两层，别当成平铺的列表：
 *   一个 (scene, name) 是一个变体，它下面可以有多个版本；
 *   **只有 status = published 的那个版本会被真正使用**。
 *   列表接口直接返回分好组的结构（含全部历史版本，版本号倒序）。
 *
 * ⚠️ 新建 = 给这个变体**加一个新版本**，不是新建变体。
 *    想加变体要换 `name`。
 */
export const promptApi = {
  /**
   * 列表（按变体分组）。
   *
   * ⚠️ 后端支持 `?scene=` 过滤，但**前端不用它** ——
   *    过滤后返回的只有那一个场景，场景下拉的选项就没了。
   *    提示词总量很小（几个场景 × 几套说法），一次拉全在本地筛更简单。
   */
  list: () => http.get<PromptGroupVO[]>('/admin/prompts'),

  create: (dto: PromptCreateDTO) => http.post<PromptVO>('/admin/prompts', dto),

  /** ⚠️ 改不了 scene / name —— 那相当于换变体，得新建 */
  update: (id: string, dto: PromptUpdateDTO) => http.put<PromptVO>(`/admin/prompts/${id}`, dto),

  /**
   * 发布某个版本 —— 发布后这个变体就切到它。
   * 恢复性操作（随时能再发别的版本），不用二次确认。
   */
  publish: (id: string) => http.post<PromptVO>(`/admin/prompts/${id}/publish`),

  /** 回滚到上一个已发布版本 */
  rollback: (id: string) => http.post<PromptVO>(`/admin/prompts/${id}/rollback`),

  /**
   * 删除某个版本。
   * ⚠️ 是破坏性操作（版本历史删了就没了），界面上要二次确认。
   */
  remove: (id: string) => http.delete<void>(`/admin/prompts/${id}`),
}
