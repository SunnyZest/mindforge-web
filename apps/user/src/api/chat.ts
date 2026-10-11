import type {
  ChatStreamDeltaEvent,
  ChatStreamDoneEvent,
  ChatStreamErrorEvent,
  ChatStreamSourcesEvent,
  ConversationDetailVO,
  ConversationVO,
  CreateConversationDTO,
  PageQuery,
  PageResult,
  PromptOptionVO,
  RagFeedbackDTO,
  RagSearchDTO,
  RagSearchResultVO,
  SendMessageDTO,
  SendMessageResultVO,
} from '@mindforge/shared'

import { http, tokenStore } from './index'

/** SSE 回调 —— 四个事件对应后端 ChatStreamEvents 的四种 */
export interface ChatStreamHandlers {
  /** 检索到的引用来源，回答开始前先到 */
  onSources?: (e: ChatStreamSourcesEvent) => void
  /** 增量文本 —— 每次一小段，拼起来才是完整回答 */
  onDelta?: (e: ChatStreamDeltaEvent) => void
  /** 结束。⚠️ 只有收到它才说明回答完整了 */
  onDone?: (e: ChatStreamDoneEvent) => void
  /** 后端主动报错（区别于网络错误） */
  onError?: (e: ChatStreamErrorEvent) => void
}

export const conversationApi = {
  page: (query: PageQuery) =>
    http.get<PageResult<ConversationVO>>('/app/conversations', { params: query }),

  detail: (id: string) => http.get<ConversationDetailVO>(`/app/conversations/${id}`),

  create: (dto: CreateConversationDTO) => http.post<ConversationVO>('/app/conversations', dto),

  remove: (id: string) => http.delete<void>(`/app/conversations/${id}`),

  /**
   * 非流式发消息。
   * ⚠️ 会等到模型把整段回答写完才返回（可能几十秒）—— 界面上优先用 stream()。
   */
  send: (id: string, dto: SendMessageDTO) =>
    http.post<SendMessageResultVO>(`/app/conversations/${id}/messages`, dto, {
      timeout: 5 * 60 * 1000,
    }),
}

/**
 * 流式发消息（SSE）。
 *
 * ★ 为什么不用 `EventSource`：
 *   它只支持 GET、不能带自定义请求头 —— 我们既要 POST body，又要带
 *   `Authorization`。所以只能用 `fetch` 读 `response.body` 手动解析 SSE 帧。
 *
 * ⚠️ 代价：绕过了 axios 的拦截器，**没有自动刷新**。
 *    所以这里做了两件事：
 *      ① 开流之前先 `http.refreshToken()` 把 token 续上
 *      ② 万一还是 401，刷新一次再重试（只重试一次，避免打转）
 *
 * ⚠️ 后端的事件名固定四个：sources / delta / done / error。
 *    收到 done 才算完整 —— 连接断了但没有 done 的话，回答是残缺的。
 *
 * @param signal 传 AbortController 的 signal 可以中途取消（用户点「停止」）
 */
export async function streamChat(
  conversationId: string,
  dto: SendMessageDTO,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  // ① 先把 token 续上，尽量别在流中间过期
  try {
    await http.refreshToken()
  } catch {
    // 刷新失败就继续用旧的试一次 —— 万一只是刷新接口抖了一下
  }

  const url = `/api/app/conversations/${conversationId}/messages/stream`

  const doFetch = () =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // SSE 的约定：告诉服务端我们要事件流
        Accept: 'text/event-stream',
        Authorization: `Bearer ${tokenStore.getAccess() ?? ''}`,
      },
      body: JSON.stringify(dto),
      signal,
    })

  let res = await doFetch()

  // ② 还是 401 → 强制刷新一次再重试（只一次）
  if (res.status === 401) {
    await http.refreshToken()
    res = await doFetch()
  }

  if (!res.ok || !res.body) {
    throw new Error(`连接失败（HTTP ${res.status}）`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  /**
   * 解析一个 SSE 帧。
   * 格式就是两行（可能多行 data，我们只用一个）：
   *     event: delta
   *     data: {"text":"你"}
   * 帧之间用空行分隔。
   */
  function handleFrame(frame: string): void {
    let event = ''
    let data = ''
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      // ⚠️ 多条 data 行要按 SSE 规范用 \n 连接，不能直接拼 ——
      //    后端的 JSON 都是单行所以看不出来，但规范就是这样，别留这个坑
      else if (line.startsWith('data:')) {
        const chunk = line.slice(5).replace(/^ /, '')
        data = data ? data + '\n' + chunk : chunk
      }
    }
    if (!event || !data) return

    try {
      const payload = JSON.parse(data)
      if (event === 'sources') handlers.onSources?.(payload as ChatStreamSourcesEvent)
      else if (event === 'delta') handlers.onDelta?.(payload as ChatStreamDeltaEvent)
      else if (event === 'done') handlers.onDone?.(payload as ChatStreamDoneEvent)
      else if (event === 'error') handlers.onError?.(payload as ChatStreamErrorEvent)
      // 其它事件名忽略 —— 后端将来加新事件时前端不至于崩
    } catch {
      // 单帧解析失败不该中断整条流（比如心跳帧、或者被截断的一帧）
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // ⚠️ 同时兼容 \n\n 和 \r\n\r\n —— 不同服务器/代理的换行不一致
      let idx: number
      while ((idx = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const frame = buffer.slice(0, idx)
        buffer = buffer.slice(idx + buffer.match(/\r?\n\r?\n/)![0].length)
        if (frame.trim()) handleFrame(frame)
      }
    }
    // 流结束了但缓冲区还有残留（最后一帧没有以空行结尾）
    if (buffer.trim()) handleFrame(buffer)
  } finally {
    // 用户取消 / 出错时把连接释放掉，别留着
    reader.cancel().catch(() => {})
  }
}

/** RAG 检索 —— 只查不生成，可以用来验证「知识库里到底有没有相关内容」 */
export const ragApi = {
  search: (dto: RagSearchDTO) => http.post<RagSearchResultVO>('/app/rag/search', dto),

  feedback: (dto: RagFeedbackDTO) => http.post<void>('/app/rag/feedback', dto),
}

/** 提示词风格选项（用户端） */
export const promptApi = {
  /** 获取当前场景下可选的提示词风格列表（如 'RAG_CHAT'） */
  listSelectable: (scene: string) =>
    http.get<PromptOptionVO[]>('/app/prompts', { params: { scene } }),
}

