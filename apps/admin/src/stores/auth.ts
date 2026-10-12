import { hasPermission, type LoginDTO, type Permission, type UserInfoVO } from '@mindforge/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { tokenStore } from '@/api'
import { authApi } from '@/api/auth'

/**
 * 登录态。
 *
 * 只放三样东西：**当前用户 / 权限 / 登录相关动作**。
 * 列表数据别往这里塞 —— 那是页面自己的状态，放进 store 只会让「谁改了我」变难查。
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfoVO | null>(null)

  /**
   * 是否已经从后端拉过当前用户信息。
   *
   * 刷新页面时 Pinia 状态会清空，但 localStorage 里的 token 还在 ——
   * 路由守卫靠这个标记判断「要不要补拉一次 /me」，不然会误判成未登录。
   */
  const loaded = ref(false)

  const isLoggedIn = computed(() => user.value !== null)
  const permissions = computed(() => user.value?.permissions ?? [])

  /** 权限判断。用法：`auth.can('admin:user:delete')` */
  function can(permission: Permission): boolean {
    if (user.value?.roles?.includes('SUPER_ADMIN')) {
      return true
    }
    return hasPermission(permissions.value, permission)
  }

  async function login(dto: LoginDTO): Promise<void> {
    const data = await authApi.login(dto)
    tokenStore.save(data)
    user.value = data.user
    loaded.value = true
  }

  /** 刷新页面后补拉当前用户 —— 顺便验证 token 还有效 */
  async function fetchMe(): Promise<void> {
    user.value = await authApi.me()
    loaded.value = true
  }

  /** 只清本地状态，不调接口 */
  function reset(): void {
    tokenStore.clear()
    user.value = null
    loaded.value = false
  }

  async function logout(): Promise<void> {
    const refreshToken = tokenStore.getRefresh()
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken)
      }
    } catch {
      // 登出接口失败不该把用户卡在页面上 —— 本地状态清掉就够了
    } finally {
      reset()
    }
  }

  return { user, loaded, isLoggedIn, permissions, can, login, fetchMe, reset, logout }
})
