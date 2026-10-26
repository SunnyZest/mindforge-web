import type { PageResult, RecycleBinVO, RecycleRestoreResultVO } from '@mindforge/shared'

import { http } from './index'

/**
 * 回收站（最近删除）。
 *
 * ★ 一期只收 **Offer** 与 **面试日程** —— 这两种删除时只把 `deleted` 置 1，
 *   没有任何关联数据被物理清理，所以恢复出来是完整的。
 *   职位 / 面试 / 对话的关联数据（技能、题目、消息）是物理删的，恢复出来是空壳，
 *   还没开放。
 *
 * ⚠️ 恢复**不是撤销操作**：它只是把逻辑删除改回去，不还原删除之后发生的任何变化。
 */
export const recycleApi = {
  /** 列表。只返回本人、且还在恢复期内的记录 */
  page: (query: { page?: number; pageSize?: number; resourceType?: string } = {}) =>
    http.get<PageResult<RecycleBinVO>>('/app/recycle-bin', { params: query }),

  /**
   * 恢复。记录不存在或已过恢复期会返回业务错误。
   *
   * ⚠️ 没有 body —— 后端靠路径上的回收站记录 id 找原资源，不需要前端传原资源 id。
   * ⚠️ 返回 `complete=false` 表示**关联数据没回来**（技能/题目/消息），
   *    调用方要提示 warning 而不是成功。
   */
  restore: (id: string) =>
    http.post<RecycleRestoreResultVO>(`/app/recycle-bin/${id}/restore`),

  /** 彻底删除（不可逆）。只删仍处于逻辑删除状态的原记录，已被恢复的不受影响 */
  purge: (id: string) => http.delete<void>(`/app/recycle-bin/${id}`),
}
