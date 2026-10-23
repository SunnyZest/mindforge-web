import { hasPermission, type LoginDTO, type Permission, type UserInfoVO } from '@mindforge/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { tokenStore } from '@/api'
import { authApi } from '@/api/auth'

/**
 * 用户端登录态。
 *
 * 只放三样：**当前用户 / 权限 / 登录动作**。业务数据（简历、面试、对话）
 * 归各自页面管，塞进这里只会让「谁改了我」变难查。
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfoVO | null>(null)

  /**
   * 是否已经从后端拉过当前用户。
   * 刷新页面时 Pinia 会清空，但 localStorage 里的 token 还在 ——
   * 路由守卫靠这个判断「要不要补拉一次 /me」，否则会误判成未登录。
   */
  const loaded = ref(false)

  const isLoggedIn = computed(() => user.value !== null)
  const permissions = computed(() => user.value?.permissions ?? [])
  const displayName = computed(() => user.value?.nickname || user.value?.username || '')

  /**
   * 是否具备任何用户端权限（`app:*`）。
   *
   * ★ 为什么需要它：一个账号可以同时挂多个角色，权限取并集。只挂 ADMIN、没挂 USER 的
   *   账号**能从用户端登录成功**（用户端登录不校验角色），但每个业务接口都会 403 ——
   *   进去只会看到一片「无权限」，像是系统坏了。
   *   SUPER_ADMIN 不受影响：它绑了全部权限码，`permissions` 里本来就有 `app:*`。
   */
  const hasUserSideAccess = computed(() =>
    permissions.value.some((p) => p.startsWith('app:')),
  )

  /** 权限判断。用法：`auth.can('app:resume:read')` */
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

  return {
    user,
    loaded,
    isLoggedIn,
    permissions,
    displayName,
    hasUserSideAccess,
    can,
    login,
    fetchMe,
    reset,
    logout,
  }
})
