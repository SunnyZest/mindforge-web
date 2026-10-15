<script setup lang="ts">
import {
  Plus,
  Delete,
  Promotion,
  VideoPause,
  ChatDotRound,
  Document,
  Loading,
  CircleCheck,
  CircleClose,
} from '@element-plus/icons-vue'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  BizError,
  formatDateTime,
  type ChunkVO,
  type ConversationVO,
  type KnowledgeBaseVO,
  type MessageVO,
  type PromptOptionVO,
  type SourceVO,
} from '@mindforge/shared'

import { chunkApi, knowledgeApi } from '@/api/knowledge'
import { conversationApi, promptApi, ragApi, streamChat } from '@/api/chat'
import { renderMarkdown } from '@/utils/markdown'

const route = useRoute()
const router = useRouter()

// ---------- 会话列表 ----------
const convLoading = ref(false)
const conversations = ref<ConversationVO[]>([])
const activeId = ref('')
const activeConv = computed(() => conversations.value.find((c) => c.conversationId === activeId.value))

// ---------- 当前会话 ----------
const messages = ref<MessageVO[]>([])
const loadingDetail = ref(false)

// ---------- 发消息 ----------
const input = ref('')
const sending = ref(false)
/** 流式接收中的回答（拼起来就是完整文本） */
const streamingText = ref('')
/** 本次回答的引用来源 —— sources 事件先到 */
const streamingSources = ref<SourceVO[]>([])
/** 检索阶段（还没开始吐字） */
const retrieving = ref(true)
let abortController: AbortController | null = null

// ---------- 提示词风格 ----------
const promptOptions = ref<PromptOptionVO[]>([])
const selectedPromptId = ref<string>('')

async function loadPromptOptions(): Promise<void> {
  try {
    const list = await promptApi.listSelectable('RAG_CHAT')
    promptOptions.value = list ?? []
    const defaultOpt = promptOptions.value.find((p) => p.isDefault) ?? promptOptions.value[0]
    if (defaultOpt && !selectedPromptId.value) {
      selectedPromptId.value = defaultOpt.id
    }
  } catch {
    promptOptions.value = []
  }
}


// ---------- 引用溯源 ----------
const chunkVisible = ref(false)
const chunkLoading = ref(false)
const chunk = ref<ChunkVO | null>(null)

// ---------- 新建对话 ----------
const newVisible = ref(false)
const newSaving = ref(false)
const kbs = ref<KnowledgeBaseVO[]>([])
const newForm = reactive({ knowledgeBaseId: '', title: '' })

const listRef = ref<HTMLElement>()

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

// ---------- 会话 ----------
async function loadConversations(): Promise<void> {
  convLoading.value = true
  try {
    const data = await conversationApi.page({ page: 1, pageSize: 50 })
    conversations.value = data.records
  } catch (e) {
    fail(e, '加载会话失败')
  } finally {
    convLoading.value = false
  }
}

async function openConversation(id: string): Promise<void> {
  if (id === activeId.value) return
  activeId.value = id
  loadingDetail.value = true
  try {
    const d = await conversationApi.detail(id)
    /**
     * ⚠️ 在【数据入口】归一化，别在模板里到处写 `?? []`。
     *    后端的 sources 对用户消息是 null（见 MessageVO.sources 的说明），
     *    直接 `m.sources.length` 会让打开历史会话时整页白屏。
     */
    messages.value = d.messages.map((m) => ({ ...m, sources: m.sources ?? [] }))
    await scrollToBottom()
  } catch (e) {
    fail(e, '加载对话失败')
  } finally {
    loadingDetail.value = false
  }
}

async function onRemoveConversation(c: ConversationVO): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除对话「${c.title}」？`, '删除对话', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  try {
    await conversationApi.remove(c.conversationId)
    if (activeId.value === c.conversationId) {
      activeId.value = ''
      messages.value = []
    }
    await loadConversations()
  } catch (e) {
    fail(e, '删除失败')
  }
}

// ---------- 新建 ----------
async function openNew(): Promise<void> {
  // 深链带过来的 kb 优先（从知识库页点「问答」进来）
  const preset = typeof route.query.kb === 'string' ? route.query.kb : ''
  newForm.knowledgeBaseId = preset
  newForm.title = preset ? '' : '与通用顾问的对话'
  newVisible.value = true

  if (!kbs.value.length) {
    try {
      const data = await knowledgeApi.page({ page: 1, pageSize: 100 })
      kbs.value = data.records
    } catch {
      // 知识库加载异常不阻断通用问答
      kbs.value = []
    }
  }
}

async function onCreateConversation(): Promise<void> {
  const title = newForm.title.trim() || (newForm.knowledgeBaseId ? '知识库对话' : '与通用顾问的对话')

  newSaving.value = true
  try {
    const c = await conversationApi.create({
      knowledgeBaseId: newForm.knowledgeBaseId || undefined,
      title,
    })
    newVisible.value = false
    await loadConversations()
    await openConversation(c.conversationId)
    // 深链参数用完就清掉，免得刷新页面又弹一次
    if (route.query.kb) await router.replace({ name: 'chat' })
  } catch (e) {
    fail(e, '创建失败')
  } finally {
    newSaving.value = false
  }
}

// ---------- 发消息 ----------
const canSend = computed(() => !!activeId.value && input.value.trim().length > 0 && !sending.value)

async function scrollToBottom(): Promise<void> {
  await nextTick()
  listRef.value?.scrollTo({ top: listRef.value.scrollHeight, behavior: 'smooth' })
}

async function onSend(): Promise<void> {
  if (!canSend.value) return

  const text = input.value.trim()
  input.value = ''
  sending.value = true
  retrieving.value = true
  streamingText.value = ''
  streamingSources.value = []

  // 先把用户消息放进列表 —— 不等后端返回，交互上更跟手
  messages.value.push({
    messageId: `tmp-${Date.now()}`,
    role: 'USER',
    content: text,
    modelName: null,
    sources: [],
    createdAt: new Date().toISOString(),
  })
  await scrollToBottom()

  abortController = new AbortController()

  try {
    await streamChat(
      activeId.value,
      {
        message: text,
        promptId: selectedPromptId.value || undefined,
      },
      {
        onSources: (e) => {
          streamingSources.value = e.sources
          // 来源到了就说明检索完了，接下来是模型吐字
          retrieving.value = false
          if (!e.hasContext && activeConv.value?.knowledgeBaseId) {
            ElMessage.info('未在知识库中检索到直接相关资料，已为您提供通用专业解答')
          }
        },
        onDelta: (e) => {
          retrieving.value = false
          streamingText.value += e.text
          void scrollToBottom()
        },
        onDone: (e) => {
          // ⚠️ 以 done 为准 —— 只有收到它，回答才是完整的
          messages.value.push({
            messageId: e.messageId,
            role: 'ASSISTANT',
            content: e.answer || streamingText.value,
            modelName: null,
            sources: streamingSources.value,
            createdAt: new Date().toISOString(),
          })
          streamingText.value = ''
        },
        onError: (e) => {
          ElMessage.error(e.message || '生成回答失败')
          if (streamingText.value) {
            messages.value.push({
              messageId: `partial-${Date.now()}`,
              role: 'ASSISTANT',
              content: `${streamingText.value}\n\n（生成中断：${e.message || '服务异常'}）`,
              modelName: null,
              sources: streamingSources.value,
              createdAt: new Date().toISOString(),
            })
            streamingText.value = ''
          }
        },
      },
      abortController.signal,
    )
  } catch (e) {
    // 用户主动取消不算错
    if (!(e instanceof DOMException && e.name === 'AbortError')) {
      fail(e, '发送失败，请重试')
    }
    // 中途取消时把已经收到的部分留下来 —— 比整段丢掉有用
    if (streamingText.value) {
      messages.value.push({
        messageId: `partial-${Date.now()}`,
        role: 'ASSISTANT',
        content: streamingText.value + '\n\n（已停止生成）',
        modelName: null,
        sources: streamingSources.value,
        createdAt: new Date().toISOString(),
      })
    }
  } finally {
    sending.value = false
    retrieving.value = true
    streamingText.value = ''
    streamingSources.value = []
    abortController = null
    await scrollToBottom()
    await loadConversations()
  }
}

function onStop(): void {
  abortController?.abort()
}

// ---------- 引用溯源 ----------
async function openSource(s: SourceVO): Promise<void> {
  chunkVisible.value = true
  chunkLoading.value = true
  chunk.value = null
  try {
    chunk.value = await chunkApi.detail(s.chunkId)
  } catch (e) {
    fail(e, '取原文片段失败')
    chunkVisible.value = false
  } finally {
    chunkLoading.value = false
  }
}

// ---------- 反馈 ----------
async function onFeedback(m: MessageVO, rating: string): Promise<void> {
  try {
    await ragApi.feedback({ messageId: m.messageId, rating })
    ElMessage.success('已反馈，谢谢')
  } catch (e) {
    fail(e, '反馈失败')
  }
}

// ---------- 生命周期 ----------
watch(
  () => route.query.kb,
  (kb) => {
    // 从知识库页点「问答」进来 → 直接弹新建
    if (kb && !activeId.value) void openNew()
  },
)

onMounted(async () => {
  void loadPromptOptions()
  await loadConversations()
  // 默认打开最近一个会话
  const first = conversations.value[0]
  if (first) await openConversation(first.conversationId)
  else if (route.query.kb) await openNew()
})

// ⚠️ 组件卸载要中断正在跑的流，否则它会一直读下去（用户已经切走了）
onUnmounted(() => abortController?.abort())
</script>

<template>
  <div class="chat">
    <!-- ---------- 左：会话列表 ---------- -->
    <aside class="side">
      <div class="side__head">
        <span class="side__title">对话</span>
        <el-button size="small" type="primary" :icon="Plus" @click="openNew">新建</el-button>
      </div>

      <div v-loading="convLoading" class="side__list">
        <div
          v-for="c in conversations"
          :key="c.conversationId"
          class="conv"
          :class="{ 'conv--on': c.conversationId === activeId }"
          @click="openConversation(c.conversationId)"
        >
          <div class="conv__main">
            <span class="conv__title">{{ c.title }}</span>
            <span class="conv__meta">
              {{ c.knowledgeBaseId ? '📚 私域+🌐官方双路' : '🤖 通用顾问' }} · {{ c.messageCount ?? 0 }} 条 · {{ formatDateTime(c.updatedAt) }}
            </span>
          </div>
          <el-button
            class="conv__del"
            size="small"
            text
            type="danger"
            :icon="Delete"
            @click.stop="onRemoveConversation(c)"
          />
        </div>

        <el-empty
          v-if="!convLoading && !conversations.length"
          :image-size="60"
          description="还没有对话"
        >
          <el-button size="small" type="primary" @click="openNew">新建对话</el-button>
        </el-empty>
      </div>
    </aside>

    <!-- ---------- 右：对话区 ---------- -->
    <section class="main">
      <template v-if="activeId">
        <div ref="listRef" v-loading="loadingDetail" class="msgs">
          <div
            v-for="m in messages"
            :key="m.messageId"
            class="msg"
            :class="`msg--${m.role.toLowerCase()}`"
          >
            <div class="msg__bubble">
              <!--
                ⚠️ 助手消息是 Markdown（实测输出里有 **加粗** 和列表），
                   所以要渲染；**用户消息保持纯文本** —— 他打的字不该被当语法解析。
                renderMarkdown 内部先转义 HTML 再替换，所以 v-html 是安全的。
              -->
              <div
                v-if="m.role === 'ASSISTANT'"
                class="msg__text md"
                v-html="renderMarkdown(m.content)"
              />
              <p v-else class="msg__text">{{ m.content }}</p>

              <!-- ★ 引用溯源：引用信息是【单独返回】的，正文里没有编号
                   （提示词里明确要求模型「不要编造引用编号或出处」） -->
              <div v-if="m.sources?.length" class="srcs">
                <span class="srcs__label">参考了 {{ m.sources?.length ?? 0 }} 处</span>
                <button
                  v-for="(s, i) in m.sources ?? []"
                  :key="s.chunkId"
                  type="button"
                  class="src"
                  :title="`查看原文：${s.documentName ?? '文档'}`"
                  @click="openSource(s)"
                >
                  <el-icon><Document /></el-icon>
                  {{ i + 1 }}. {{ s.documentName ?? '文档' }}
                  <span v-if="s.pageNo" class="src__page">p{{ s.pageNo }}</span>
                </button>
              </div>

              <!-- 反馈按钮只给助手消息，且要等流结束（有真 messageId） -->
              <div v-if="m.role === 'ASSISTANT' && !m.messageId.startsWith('partial')" class="fb">
                <button type="button" class="fb__btn" @click="onFeedback(m, 'HELPFUL')">
                  <el-icon><CircleCheck /></el-icon>有用
                </button>
                <button type="button" class="fb__btn" @click="onFeedback(m, 'NOT_HELPFUL')">
                  <el-icon><CircleClose /></el-icon>不准
                </button>
              </div>
            </div>
          </div>

          <!-- 流式回答 -->
          <div v-if="sending" class="msg msg--assistant">
            <div class="msg__bubble">
              <!-- 检索阶段：还没吐字，先说明在干什么 -->
              <p v-if="retrieving && !streamingText" class="msg__thinking">
                <el-icon class="is-loading"><Loading /></el-icon>
                {{ activeConv?.knowledgeBaseId ? '正在双路联合检索（个人知识库 + 全站官方智库）…' : '正在思考回答…' }}
              </p>
              <template v-else>
                <div class="msg__text md">
                  <span v-html="renderMarkdown(streamingText)" /><span class="caret" />
                </div>
                <div v-if="streamingSources.length" class="srcs">
                  <span class="srcs__label">参考了 {{ streamingSources.length }} 处</span>
                  <button
                    v-for="(s, i) in streamingSources"
                    :key="s.chunkId"
                    type="button"
                    class="src"
                    @click="openSource(s)"
                  >
                    <el-icon><Document /></el-icon>
                    {{ i + 1 }}. {{ s.documentName ?? '文档' }}
                  </button>
                </div>
              </template>
            </div>
          </div>

          <el-empty
            v-if="!loadingDetail && !messages.length && !sending"
            :image-size="80"
            description="问点什么吧 —— 优先基于知识库资料回答，未收录时由通用专业顾问为您解答"
          />
        </div>

        <div class="composer">
          <el-input
            v-model="input"
            type="textarea"
            :rows="3"
            :disabled="sending"
            placeholder="问点什么…（Enter 发送，Shift+Enter 换行）"
            @keydown.enter.exact.prevent="onSend"
          />
          <div class="composer__foot">
            <div v-if="promptOptions.length" class="composer__style">
              <span class="style-label">风格</span>
              <el-select
                v-model="selectedPromptId"
                size="small"
                :disabled="sending"
                placeholder="默认风格"
                class="style-select"
              >
                <el-option
                  v-for="opt in promptOptions"
                  :key="opt.id"
                  :label="opt.label"
                  :value="opt.id"
                >
                  <div class="style-opt">
                    <span class="style-opt__label">{{ opt.label }}</span>
                    <span v-if="opt.description" class="style-opt__desc">{{ opt.description }}</span>
                  </div>
                </el-option>
              </el-select>
            </div>
            <span v-else class="composer__hint">优先基于知识库回答，未收录内容由通用顾问补充</span>
            <el-button v-if="sending" :icon="VideoPause" @click="onStop">停止</el-button>
            <el-button type="primary" :icon="Promotion" :disabled="!canSend" @click="onSend">
              发送
            </el-button>
          </div>
        </div>
      </template>

      <!-- 没选会话 -->
      <div v-else class="blank">
        <el-icon class="blank__icon"><ChatDotRound /></el-icon>
        <p class="blank__text">左边选一个对话，或者新建一个</p>
        <el-button type="primary" :icon="Plus" @click="openNew">新建对话</el-button>
      </div>
    </section>

    <!-- ---------- 原文片段 ---------- -->
    <el-dialog v-model="chunkVisible" title="原文片段" width="min(640px, 92vw)" append-to-body>
      <div v-loading="chunkLoading" class="chunk">
        <template v-if="chunk">
          <p class="chunk__meta">
            {{ chunk.documentName ?? '文档' }}
            <template v-if="chunk.chunkIndex !== null">
              · 第 {{ chunk.chunkIndex + 1 }} 块</template
            >
            <template v-if="chunk.pageNo"> · 第 {{ chunk.pageNo }} 页</template>
          </p>
          <pre class="chunk__text">{{ chunk.content }}</pre>
        </template>
      </div>
    </el-dialog>

    <!-- ---------- 新建对话 ---------- -->
    <el-dialog v-model="newVisible" title="新建对话" width="min(480px, 92vw)" append-to-body>
      <el-form label-position="top" @submit.prevent="onCreateConversation">
        <el-form-item label="知识库（可选）">
          <el-select
            v-model="newForm.knowledgeBaseId"
            placeholder="选择知识库，不选为通用顾问"
            clearable
          >
            <el-option label="🤖 MindForge AI 通用顾问（无需知识库）" value="" />
            <el-option
              v-for="k in kbs"
              :key="k.id"
              :label="k.isSystem === 1 ? `🌐 ${k.name}（官方智库）` : k.name"
              :value="k.id"
            >
              <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <span style="display: flex; align-items: center; gap: 6px;">
                  <span>{{ k.name }}</span>
                  <el-tag v-if="k.isSystem === 1" type="success" size="small" effect="plain" round>
                    官方智库
                  </el-tag>
                </span>
                <span class="opt__hint">{{ k.documentCount ?? 0 }} 份文档</span>
              </div>
            </el-option>
          </el-select>
          <p v-if="newForm.knowledgeBaseId" style="margin: 6px 0 0; font-size: 12px; color: var(--mf-text-tertiary); line-height: 1.5;">
            🌐 双路检索已开启：提问时将同时检索当前所选知识库与全站官方智库，并经 Rerank 联合精排。
          </p>
        </el-form-item>

        <el-form-item label="标题">
          <el-input v-model="newForm.title" placeholder="如：系统架构与求职咨询" maxlength="255" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="newVisible = false">取消</el-button>
        <el-button type="primary" :loading="newSaving" @click="onCreateConversation"
          >创建</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.chat {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: var(--mf-space-4);
  height: calc(100vh - 60px - var(--mf-space-6) * 2);
  max-width: 1200px;
  margin: 0 auto;
}

@media (width <= 800px) {
  .chat {
    grid-template-columns: 1fr;
    height: auto;
  }

  .side {
    max-height: 200px;
  }
}

/* ---------- 左侧 ---------- */
.side {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3);
  padding: var(--mf-space-4);
  overflow: hidden;
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
}

.side__head {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
  justify-content: space-between;
}

.side__title {
  font-size: var(--mf-font-sm);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-secondary);
}

.side__list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--mf-space-1);
  min-height: 80px;
  overflow-y: auto;
}

.conv {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
  padding: var(--mf-space-2) var(--mf-space-3);
  cursor: pointer;
  border-radius: var(--mf-radius-md);
  transition: background-color var(--mf-duration-fast) var(--mf-ease-out);
}

.conv:hover {
  background-color: var(--mf-glass-tint-strong);
}

.conv--on {
  background-color: var(--mf-primary-subtle);
}

.conv__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.conv__title {
  overflow: hidden;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv__meta {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

/* 删除按钮平时不显示 —— 列表里每行都挂个红叉太吵 */
.conv__del {
  opacity: 0;
  transition: opacity var(--mf-duration-fast) var(--mf-ease-out);
}

.conv:hover .conv__del,
.conv__del:focus-visible {
  opacity: 1;
}

/* ---------- 右侧 ---------- */
.main {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-4);
  min-height: 0;
}

.msgs {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--mf-space-4);
  min-height: 120px;
  padding: var(--mf-space-5);
  overflow-y: auto;
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
}

.msg {
  display: flex;
}

.msg--user {
  justify-content: flex-end;
}

.msg__bubble {
  max-width: 80%;
  padding: var(--mf-space-3) var(--mf-space-4);
  border-radius: var(--mf-radius-lg);
}

.msg--user .msg__bubble {
  color: #fff;
  background-color: var(--mf-primary);
}

.msg--assistant .msg__bubble {
  background-color: var(--mf-bg-subtle);
}

.msg__text {
  margin: 0;
  font-size: var(--mf-font-sm);
  line-height: 1.8;
  overflow-wrap: anywhere;
}

/* 用户消息是纯文本，需要保留他敲的换行；助手消息走 markdown 渲染，不用 */
.msg--user .msg__text {
  white-space: pre-wrap;
}

/* ---------- 渲染出来的 Markdown ---------- */
.md :deep(.md__p) {
  margin: 0 0 var(--mf-space-2);
}

.md :deep(.md__p:last-child) {
  margin-bottom: 0;
}

.md :deep(.md__h) {
  margin: var(--mf-space-3) 0 var(--mf-space-2);
  font-size: var(--mf-font-md);
  font-weight: var(--mf-weight-medium);
}

.md :deep(.md__ul),
.md :deep(.md__ol) {
  margin: 0 0 var(--mf-space-2);
  padding-left: 1.4em;
}

.md :deep(li) {
  margin-bottom: 2px;
}

.md :deep(.md__code) {
  padding: 1px 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92em;
  background-color: var(--mf-glass-tint-strong);
  border-radius: 4px;
}

.msg__thinking {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
  margin: 0;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
}

/* 打字光标 —— 流式生成时让它看起来「还在写」 */
.caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: text-bottom;
  background-color: var(--mf-primary);
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .caret {
    animation: none;
  }
}

/* ---------- 引用 ---------- */
.srcs {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-1);
  align-items: flex-start;
  margin-top: var(--mf-space-3);
  padding-top: var(--mf-space-3);
  border-top: 1px solid var(--mf-glass-border-soft);
}

.srcs__label {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.src {
  display: inline-flex;
  gap: var(--mf-space-1);
  align-items: center;
  padding: 2px var(--mf-space-3);
  font-size: var(--mf-font-xs);
  color: var(--mf-primary-text);
  cursor: pointer;
  background-color: var(--mf-primary-subtle);
  border: none;
  border-radius: var(--mf-radius-pill);
}

.src:hover {
  filter: brightness(0.96);
}

.src:focus-visible {
  outline: 2px solid var(--mf-primary);
  outline-offset: 2px;
}

.src__page {
  color: var(--mf-text-tertiary);
}

/* ---------- 反馈 ---------- */
.fb {
  display: flex;
  gap: var(--mf-space-3);
  margin-top: var(--mf-space-3);
}

.fb__btn {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
  cursor: pointer;
  background: none;
  border: none;
}

.fb__btn:hover {
  color: var(--mf-primary-text);
}

.fb__btn:focus-visible {
  outline: 2px solid var(--mf-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

/* ---------- 输入区 ---------- */
.composer {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--mf-space-3);
  padding: var(--mf-space-4);
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
}

.composer__foot {
  display: flex;
  gap: var(--mf-space-3);
  align-items: center;
  justify-content: flex-end;
}

.composer__style {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
  margin-right: auto;
}

.style-label {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
  white-space: nowrap;
}

.style-select {
  width: 140px;
}

.style-opt {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 0;
}

.style-opt__label {
  font-size: var(--mf-font-sm);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-primary);
}

.style-opt__desc {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.composer__hint {
  margin-right: auto;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

/* ---------- 空态 ---------- */
.blank {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--mf-space-3);
  align-items: center;
  justify-content: center;
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
}

.blank__icon {
  font-size: 40px;
  color: var(--mf-text-tertiary);
}

.blank__text {
  margin: 0;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
}

/* ---------- 原文片段 ---------- */
.chunk__meta {
  margin: 0 0 var(--mf-space-3);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.chunk__text {
  max-height: 420px;
  margin: 0;
  overflow-y: auto;
  font-family: inherit;
  font-size: var(--mf-font-sm);
  line-height: 1.8;
  color: var(--mf-text-secondary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.opt__hint {
  margin-left: var(--mf-space-2);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}
</style>
