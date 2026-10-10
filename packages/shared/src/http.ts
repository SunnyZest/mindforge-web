import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios'

import type { TokenStore } from './auth'
import type { Result, TokenVO } from './types'

/**
 * 业务错误：后端返回了 HTTP 200，但信封里的 `code !== 0`。
 *
 * 单独一个类而不是复用 `Error`，是为了让调用方能按 `code` 分支处理 ——
 * 比如 40301（无权限）提示「无权限」，42901（限流）提示「稍后再试」。
 */
export class BizError extends Error {
  readonly code: number
  readonly traceId: string | undefined

  constructor(code: number, message: string, traceId?: string) {
    super(message)
    this.name = 'BizError'
    this.code = code
    this.traceId = traceId
  }
}

/**
 * HTTP 层错误：拿到了非 2xx，但响应体不是我们约定的 `{code,message,data}` 信封
 * （比如网关返回的 HTML 错误页），或者根本没拿到响应（后端没起 / 断网）。
 */
export class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

// 给 axios 的 config 补两个自定义字段
declare module 'axios' {
  export interface AxiosRequestConfig {
    /**
     * 跳过 401 自动刷新。**登录接口必须带** ——
     * 密码错时后端返回的也是 401，不跳过的话会被当成「会话过期」，
     * 用户看到的是「登录已过期」而不是「用户名或密码错误」。
     */
    skipRefresh?: boolean
    /** 内部用：这个请求是否已经重放过，防止无限重试 */
    _retried?: boolean
  }
}

export interface HttpClientOptions {
  /** 一般是 `/api`（开发时由 Vite 代理到 :8080，上线由 nginx 代理） */
  baseURL: string
  /** 刷新接口路径，如 `/admin/auth/refresh` —— 两个端不一样 */
  refreshPath: string
  /** token 存哪 */
  tokenStore: TokenStore
  /** 刷新也失败时的回调 —— 一般用来清 Pinia 状态 + 跳登录页 */
  onSessionExpired?: () => void
}

export interface HttpClient {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T>
  put<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T>
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T>
  /** 底层实例，给需要自定义的场景用（如上传进度回调） */
  readonly raw: AxiosInstance
}

/**
 * 建一个 HTTP 客户端。两个端各建一个（刷新路径和 token 前缀不同）。
 *
 * <b>它做了三件事</b>：
 * 1. 自动带上 `Authorization` 头
 * 2. 拆信封 —— 调用方直接拿到 `data`，不用每次写 `res.data.data`
 * 3. 401 时自动刷新并重放原请求（★ 单飞，见下方说明）
 */
export function createHttp(options: HttpClientOptions): HttpClient {
  const { baseURL, refreshPath, tokenStore, onSessionExpired } = options

  const instance = axios.create({ baseURL, timeout: 30_000 })

  // ---------- 请求拦截器：带上 accessToken ----------
  instance.interceptors.request.use((config) => {
    const token = tokenStore.getAccess()
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`)
    }
    return config
  })

  // ---------- ★ 单飞刷新 ----------
  //
  // 为什么必须「同一时刻只跑一个刷新」：
  //   后端的 refreshToken 是【轮换 + 重放检测】的 —— 一个 refreshToken 用过一次就作废。
  //   如果页面上三个请求同时 401、三个都去调刷新接口，
  //   第二个刷新会被后端判成「重放」，整条会话直接被撤销、强制重新登录。
  //   这个现象很难复现（要并发刚好凑上），但用户会莫名其妙被踢。
  //
  // 做法：第一个到的去真刷新，后来的都拿同一个 Promise 等结果。
  let refreshing: Promise<string> | null = null

  function refreshAccessToken(): Promise<string> {
    refreshing ??= doRefresh().finally(() => {
      // 无论成功失败都要清掉，否则下次 401 会拿到一个已经 settle 的旧 Promise
      refreshing = null
    })
    return refreshing
  }

  async function doRefresh(): Promise<string> {
    const refreshToken = tokenStore.getRefresh()
    if (!refreshToken) {
      throw new BizError(40101, '登录已过期，请重新登录')
    }

    // ⚠️ 用【裸 axios】而不是上面的 instance：
    //    走 instance 的话，刷新接口自己返回 401 时又会被拦截器抓去刷新 —— 无限递归。
    const res = await axios.post<Result<TokenVO>>(`${baseURL}${refreshPath}`, { refreshToken })
    const body = res.data
    if (body.code !== 0) {
      throw new BizError(body.code, body.message, body.traceId)
    }
    tokenStore.save(body.data)
    return body.data.accessToken
  }

  // ---------- 响应拦截器：401 刷新重放 / 错误统一成 BizError ----------
  instance.interceptors.response.use(
    (response) => response,

    async (error: unknown) => {
      if (!(error instanceof AxiosError)) {
        return Promise.reject(error)
      }

      const config = error.config
      const status = error.response?.status

      // ① 401 → 刷新一次，然后原样重放
      if (status === 401 && config && !config.skipRefresh && !config._retried) {
        config._retried = true
        try {
          await refreshAccessToken()
          // 重放原请求 —— 请求拦截器会自动带上刚存进去的新 token
          return await instance.request(config)
        } catch (refreshError) {
          tokenStore.clear()
          onSessionExpired?.()
          return Promise.reject(refreshError)
        }
      }

      // ② 连响应都没有 —— 后端没起 / 断网。报清楚一点，别让用户去猜
      if (!error.response) {
        return Promise.reject(new HttpError(0, '网络异常：请确认后端已启动'))
      }

      // ③ 其他 HTTP 错误 —— 后端在响应体里也放了 {code,message}，
      //    翻出来给用户看。不然前端只能显示「Request failed with status code 403」
      const body = error.response.data as Result<unknown> | undefined
      if (body && typeof body.code === 'number') {
        return Promise.reject(new BizError(body.code, body.message, body.traceId))
      }
      return Promise.reject(new HttpError(status ?? 0, error.message))
    },
  )

  /** 发请求 + 拆信封。调用方拿到的是 `data` 本身 */
  async function request<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await instance.request<Result<T>>(config)
    const body = response.data

    // 后端约定：code = 0 才是成功
    if (body.code !== 0) {
      throw new BizError(body.code, body.message, body.traceId)
    }
    return body.data
  }

  return {
    get: <T>(url: string, config?: AxiosRequestConfig) =>
      request<T>({ ...config, method: 'GET', url }),

    post: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
      request<T>({ ...config, method: 'POST', url, data: body }),

    put: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
      request<T>({ ...config, method: 'PUT', url, data: body }),

    delete: <T>(url: string, config?: AxiosRequestConfig) =>
      request<T>({ ...config, method: 'DELETE', url }),

    raw: instance,
  }
}
