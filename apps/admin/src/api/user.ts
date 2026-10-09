import type { PageResult, UserListQuery, UserSummaryVO } from '@mindforge/shared'

import { http } from './index'

export const userApi = {
  /**
   * 用户列表（分页 + 筛选）。
   *
   * 参数里值为 `undefined` 的项 axios 会直接不拼进 query string ——
   * 所以 `keyword: ''` 和 `keyword: undefined` 不一样：前者会拼 `keyword=`，
   * 后者表示「不筛」。调用时记得把空串转成 undefined。
   */
  page: (query: UserListQuery) =>
    http.get<PageResult<UserSummaryVO>>('/admin/users', { params: query }),
}
