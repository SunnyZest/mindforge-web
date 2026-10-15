import type {
  OfferCompareDTO,
  OfferCompareVO,
  OfferCreateDTO,
  OfferQuery,
  OfferStatusDTO,
  OfferUpdateDTO,
  OfferVO,
  PageResult,
} from '@mindforge/shared'

import { http } from './index'

/**
 * 用户端 Offer 对比（五维打分表）。
 *
 * ★ 全部是**本地计算**，不调模型 —— 打分是用户自己的事，
 * 让模型替他打分反而越界。所以这些接口都是毫秒级、不烧 token。
 */
export const offerApi = {
  /**
   * 列表。排序白名单：companyName | salaryAnnual | createdAt | updatedAt
   * （非法 sortBy 后端返回 40001）。
   */
  page: (query: OfferQuery = {}) => http.get<PageResult<OfferVO>>('/app/offers', { params: query }),

  detail: (id: string) => http.get<OfferVO>(`/app/offers/${id}`),

  /**
   * 新增 Offer。
   *
   * 可带 `jobId` 从投递看板导入（后端自动带出公司名与岗位名）——
   * ⚠️ 薪资**不会**自动带：`job.salaryOffer` 是自由文本（"30k*15" / "面议"），
   * 而后端要的是数值（万元），猜错单位比让用户自己填更糟。
   */
  create: (dto: OfferCreateDTO) => http.post<OfferVO>('/app/offers', dto),

  /**
   * 修改。
   *
   * ⚠️ **局部更新** —— 只传要改的字段，未传的保持不变（后端用 LambdaUpdateWrapper）。
   * 想把岗位名清空要显式传空串。
   */
  update: (id: string, dto: OfferUpdateDTO) => http.put<OfferVO>(`/app/offers/${id}`, dto),

  remove: (id: string) => http.delete<void>(`/app/offers/${id}`),

  /** 接受 / 拒绝 / 回到考虑中 */
  updateStatus: (id: string, dto: OfferStatusDTO) =>
    http.put<OfferVO>(`/app/offers/${id}/status`, dto),

  /**
   * 多 Offer 对比 —— 核心接口。
   *
   * ★ 权重**不落库**，每次由这里带：拖一下权重滑块 → 重新调 compare → 排名实时变。
   *   不传权重 = 五维等权。
   *
   * ⚠️ 用 POST 而不是 GET：要传 id 列表和五个权重，塞 query 又长又难读。
   *    但它不改任何数据，所以后端权限按读操作算（app:offer:read）。
   */
  compare: (dto: OfferCompareDTO) => http.post<OfferCompareVO>('/app/offers/compare', dto),
}
