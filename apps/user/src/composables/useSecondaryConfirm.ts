import { ElMessageBox } from 'element-plus'

import { authApi } from '@/api/auth'

/**
 * 高危操作的二次确认（用户端）。
 *
 * 后端对「彻底删除回收站记录」这类不可逆操作**强制**要求凭据
 * （`X-Confirm-Token` 或 `X-Confirm-Password`），缺了会直接返回
 * `CONFIRM_REQUIRED`(40304) 拒绝执行 —— 光弹一个本地 confirm 是不够的。
 *
 * 这里走 token 路线：密码只发一次换凭证（5 分钟有效、用过即核销），
 * 不在业务请求里重复带密码。
 *
 * 用法：
 * ```ts
 * const res = await runConfirm({
 *   message: `「${row.title}」将被永久删除，无法恢复。`,
 *   action: (token) => recycleApi.purge(row.id, token),
 * })
 * if (!res.ok) return          // 用户取消，什么都不做
 * ElMessage.success('已彻底删除')
 * ```
 *
 * ⚠️ 管理端有一份同名实现（`apps/admin/src/composables/useSecondaryConfirm.ts`），
 *    逻辑相同但换 token 的接口前缀不同（`/admin/` 与 `/app/`）。
 *    没有抽到 `packages/shared`：那份依赖 Element Plus 的 `ElMessageBox`，
 *    而 shared 只依赖 axios / echarts，把 EP 拉进去不值当。
 *    **改协议时两边一起改。**
 */
export function useSecondaryConfirm() {
  async function runConfirm<T>(options: {
    /** 弹框正文：写清后果和操作对象 */
    message: string
    title?: string
    /** 拿到凭证后真正要发的请求；token 必须透传给对应的 api 方法 */
    action: (confirmToken: string) => Promise<T>
  }): Promise<{ ok: true; value: T } | { ok: false }> {
    let password: string
    try {
      const { value } = await ElMessageBox.prompt(
        options.message,
        options.title ?? '高危操作二次确认',
        {
          type: 'warning',
          confirmButtonText: '确认执行',
          cancelButtonText: '取消',
          inputType: 'password',
          inputPlaceholder: '请输入当前账号的登录密码',
          // 空密码不发请求，省一次必然失败的往返
          inputValidator: (v: string) => (v && v.trim() ? true : '请输入密码'),
        },
      )
      password = String(value ?? '')
    } catch {
      // 用户点了取消/关闭 —— 这是正常操作，不该报错
      return { ok: false }
    }

    // 密码错误会抛在这里，由调用方的 catch 统一提示（BizError 里带着后端的话）
    const { confirmToken } = await authApi.issueConfirmToken(password)

    const value = await options.action(confirmToken)
    return { ok: true, value }
  }

  return { runConfirm }
}
