<script setup lang="ts">
import {
  Back,
  Upload,
  Refresh,
  Delete,
  Download,
  ChatDotRound,
  Edit,
} from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  BizError,
  formatBytes,
  formatDateTime,
  type DocumentVO,
  type KnowledgeBaseStatsVO,
  type KnowledgeBaseVO,
} from '@mindforge/shared'

import { documentApi, knowledgeApi } from '@/api/knowledge'
import KnowledgeBaseDialog from '@/components/KnowledgeBaseDialog.vue'
import { useAutoRefresh } from '@/composables/useAutoRefresh'

const route = useRoute()
const router = useRouter()

const id = computed(() => String(route.params.id))

const loading = ref(false)
const uploading = ref(false)
const acting = ref<string | null>(null)

const kb = ref<KnowledgeBaseVO | null>(null)
const stats = ref<KnowledgeBaseStatsVO | null>(null)
const rows = ref<DocumentVO[]>([])
const total = ref(0)
const query = reactive({ page: 1, pageSize: 10 })

const dialogVisible = ref(false)
const fileInput = ref<HTMLInputElement>()

/** 和 Java `UploadConstants.DOCUMENT_EXT` 逐字对齐 */
const ACCEPT = '.pdf,.docx,.txt,.md,.markdown,.html,.htm'

/** 总状态 */
const STATUS_TEXT: Record<string, string> = {
  UPLOADED: '待处理',
  PARSING: '处理中',
  PARSED: '已解析',
  CHUNKED: '已分块',
  COMPLETED: '已完成',
  FAILED: '失败',
}
const STATUS_TONE: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  UPLOADED: 'neutral',
  PARSING: 'warning',
  PARSED: 'warning',
  CHUNKED: 'warning',
  COMPLETED: 'success',
  FAILED: 'danger',
}

/** 三个子阶段的中文名 */
const STAGES: { key: 'parseStatus' | 'chunkStatus' | 'vectorStatus'; label: string }[] = [
  { key: 'parseStatus', label: '解析' },
  { key: 'chunkStatus', label: '分块' },
  { key: 'vectorStatus', label: '向量' },
]

const STAGE_TEXT: Record<string, string> = {
  PENDING: '等待',
  PARSING: '进行中',
  CHUNKING: '进行中',
  EMBEDDING: '进行中',
  SUCCESS: '完成',
  FAILED: '失败',
}

/**
 * el-table 插槽里的 `row` 类型是 `DefaultRow`（Element Plus 的泛型占位符），
 * 直接传给需要具体类型的方法会报「缺少属性」。
 * 转一下即可 —— 和 apps/admin 里 asLog() 的做法一致。
 */
function asDoc(row: unknown): DocumentVO {
  return row as DocumentVO
}

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

async function load(options: { silent?: boolean } = {}): Promise<void> {
  const { silent = false } = options
  if (!silent) loading.value = true
  try {
    const [detail, st, docs] = await Promise.all([
      knowledgeApi.detail(id.value),
      knowledgeApi.stats(id.value),
      knowledgeApi.documents(id.value, { page: query.page, pageSize: query.pageSize }),
    ])
    kb.value = detail
    stats.value = st
    rows.value = docs.records
    total.value = docs.total
  } catch (e) {
    if (!silent) fail(e, '加载失败')
  } finally {
    if (!silent) loading.value = false
  }
}

/**
 * 有文档还在处理中就自动刷新 —— 「解析 → 分块 → 向量」是后端异步跑的，
 * 光靠手动点根本不知道什么时候好。逻辑在 composables/useAutoRefresh.ts。
 */
const {
  active: refreshing,
  exhausted,
  resume,
} = useAutoRefresh({
  shouldContinue: () =>
    rows.value.some((d) =>
      ['PENDING', 'PARSING', 'CHUNKING', 'EMBEDDING'].some((s) =>
        [d.parseStatus, d.chunkStatus, d.vectorStatus].includes(s as never),
      ),
    ),
  onRefresh: () => load({ silent: true }),
})

// ---------- 上传 ----------
function pickFile(): void {
  fileInput.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  // ⚠️ 先清空 input.value：不清的话「选同一个文件第二次」不会触发 change，
  //    用户会以为按钮坏了
  input.value = ''
  if (!files.length) return

  const validFiles = files.filter((f) => f.size > 0)
  if (!validFiles.length) {
    ElMessage.warning('不能上传空文件（0 字节）')
    return
  }

  uploading.value = true
  try {
    if (validFiles.length === 1) {
      await knowledgeApi.uploadDocument(id.value, validFiles[0])
      ElMessage.success('已上传，正在后台处理（解析 → 分块 → 向量）')
    } else {
      const results = await Promise.allSettled(
        validFiles.map((file) => knowledgeApi.uploadDocument(id.value, file)),
      )
      const successCount = results.filter((r) => r.status === 'fulfilled').length
      const failCount = results.length - successCount
      if (failCount === 0) {
        ElMessage.success(`已批量上传 ${successCount} 个文件，正在后台处理`)
      } else {
        ElMessage.warning(`批量上传完成：成功 ${successCount} 个，失败 ${failCount} 个`)
      }
    }
    await load()
    resume()
  } catch (e) {
    fail(e, '上传失败')
  } finally {
    uploading.value = false
  }
}

// ---------- 批量操作 ----------
const selectedRows = ref<DocumentVO[]>([])
const tableRef = ref()
const batchActing = ref(false)

function onSelectionChange(selection: DocumentVO[]): void {
  selectedRows.value = selection
}

function clearSelection(): void {
  tableRef.value?.clearSelection()
  selectedRows.value = []
}

async function onBatchRetry(): Promise<void> {
  if (!selectedRows.value.length) return
  batchActing.value = true
  try {
    const results = await Promise.allSettled(
      selectedRows.value.map((d) => documentApi.retry(d.documentId)),
    )
    const successCount = results.filter((r) => r.status === 'fulfilled').length
    ElMessage.success(`已重新提交 ${successCount} 篇文档进入流水线处理`)
    clearSelection()
    await load()
    resume()
  } catch (e) {
    fail(e, '批量重试失败')
  } finally {
    batchActing.value = false
  }
}

async function onBatchDelete(): Promise<void> {
  if (!selectedRows.value.length) return
  const count = selectedRows.value.length
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${count} 篇文档？分块和向量索引也会一起删掉，操作不可恢复。`,
      '批量删除确认',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }

  batchActing.value = true
  try {
    const results = await Promise.allSettled(
      selectedRows.value.map((d) => documentApi.remove(d.documentId)),
    )
    const successCount = results.filter((r) => r.status === 'fulfilled').length
    ElMessage.success(`已成功删除 ${successCount} 篇文档`)
    clearSelection()
    await load()
  } catch (e) {
    fail(e, '批量删除失败')
  } finally {
    batchActing.value = false
  }
}

// ---------- 文档操作 ----------
async function onRetry(d: DocumentVO): Promise<void> {
  acting.value = d.documentId
  try {
    await documentApi.retry(d.documentId)
    ElMessage.success('已重新提交处理')
    await load()
  } catch (e) {
    fail(e, '重试失败')
  } finally {
    acting.value = null
  }
}

/**
 * 下载。
 * ⚠️ 后端是 302 跳转到预签名 URL，不是文件流 —— 所以不能让 axios 去请求，
 *    直接让浏览器导航过去，由它处理重定向和下载。
 */
function onDownload(d: DocumentVO): void {
  window.open(documentApi.downloadUrl(d.documentId), '_blank', 'noopener')
}

async function onRemove(d: DocumentVO): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除「${d.fileName}」？分块和向量也会一起删掉。`, '删除文档', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  try {
    await documentApi.remove(d.documentId)
    ElMessage.success('已删除')
    if (rows.value.length === 1 && query.page > 1) query.page -= 1
    await load()
  } catch (e) {
    fail(e, '删除失败')
  }
}

function startChat(): void {
  void router.push({ name: 'chat', query: { kb: id.value } })
}

const empty = computed(() => !loading.value && rows.value.length === 0)

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="head">
      <el-button text :icon="Back" @click="router.push({ name: 'knowledge' })">返回列表</el-button>

      <div class="head__main">
        <div class="head__title-row">
          <h1 class="head__title">{{ kb?.name ?? '知识库' }}</h1>
          <el-tag v-if="kb?.isSystem === 1" type="success" size="small" effect="plain" round>
            官方智库
          </el-tag>
        </div>
        <p class="head__meta">{{ kb?.description || '（没有描述）' }}</p>
      </div>

      <div class="head__actions">
        <el-button v-if="kb?.isSystem !== 1" :icon="Edit" :disabled="!kb" @click="dialogVisible = true">编辑</el-button>
        <el-button type="primary" :icon="ChatDotRound" :disabled="!kb" @click="startChat">
          开始问答
        </el-button>
      </div>
    </header>

    <!-- ---------- 统计 ---------- -->
    <div class="stats">
      <div class="stat">
        <span class="stat__n">{{ stats?.documentCount ?? '-' }}</span>
        <span class="stat__t">文档</span>
      </div>
      <div class="stat">
        <span class="stat__n">{{ stats?.chunkCount ?? '-' }}</span>
        <span class="stat__t">分块</span>
      </div>
      <div class="stat">
        <span class="stat__n stat__n--ok">{{ stats?.completedDocuments ?? '-' }}</span>
        <span class="stat__t">已完成</span>
      </div>
      <div class="stat">
        <!-- 失败数为 0 时压淡 —— 没失败就别用红色抢注意力 -->
        <span class="stat__n" :class="{ 'stat__n--bad': (stats?.failedDocuments ?? 0) > 0 }">
          {{ stats?.failedDocuments ?? '-' }}
        </span>
        <span class="stat__t">失败</span>
      </div>
    </div>

    <!-- ---------- 文档 ---------- -->
    <section class="pane">
      <div class="pane__head">
        <h2 class="pane__title">文档</h2>

        <div class="pane__actions">
          <span v-if="refreshing || exhausted" class="refresh">
            <span class="refresh__dot" :class="{ 'refresh__dot--on': refreshing }" />
            {{ exhausted ? '自动刷新已暂停' : '处理中，自动刷新' }}
            <el-button v-if="exhausted" link type="primary" @click="resume">继续</el-button>
          </span>

          <template v-if="kb?.isSystem !== 1">
            <input
              ref="fileInput"
              type="file"
              multiple
              :accept="ACCEPT"
              class="pane__file"
              @change="onFileChange"
            />
            <el-button type="primary" :icon="Upload" :loading="uploading" @click="pickFile">
              上传文档
            </el-button>
          </template>
          <el-tag v-else type="info" effect="plain">官方智库仅只读浏览，不可上传</el-tag>
        </div>
      </div>

      <div v-if="kb?.isSystem !== 1 && selectedRows.length > 0" class="batch-bar">
        <span class="batch-bar__tip">
          已选择 <strong>{{ selectedRows.length }}</strong> 篇文档
        </span>
        <div class="batch-bar__actions">
          <el-button
            type="warning"
            size="small"
            :loading="batchActing"
            @click="onBatchRetry"
          >
            批量重试
          </el-button>
          <el-button
            type="danger"
            size="small"
            :loading="batchActing"
            @click="onBatchDelete"
          >
            批量删除
          </el-button>
          <el-button link size="small" @click="clearSelection">取消选择</el-button>
        </div>
      </div>

      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="rows"
        border
        stripe
        @selection-change="onSelectionChange"
      >
        <el-table-column v-if="kb?.isSystem !== 1" type="selection" width="48" align="center" />
        <el-table-column label="文件名" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="doc__name">{{ asDoc(row).fileName }}</span>
            <span class="doc__size">{{ formatBytes(asDoc(row).fileSize) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <span class="tag" :class="`tag--${STATUS_TONE[asDoc(row).status] ?? 'neutral'}`">
              {{ STATUS_TEXT[asDoc(row).status] ?? asDoc(row).status }}
            </span>
          </template>
        </el-table-column>

        <!-- 三个阶段分开显示 —— 总状态只说明「到哪一步了」，
             卡在哪一段要看这里 -->
        <el-table-column label="处理进度" width="220">
          <template #default="{ row }">
            <div class="stages">
              <span
                v-for="s in STAGES"
                :key="s.key"
                class="stage"
                :class="{
                  'stage--ok': asDoc(row)[s.key] === 'SUCCESS',
                  'stage--bad': asDoc(row)[s.key] === 'FAILED',
                  'stage--run': ['PARSING', 'CHUNKING', 'EMBEDDING'].includes(
                    asDoc(row)[s.key] ?? '',
                  ),
                }"
              >
                {{ s.label
                }}{{
                  STAGE_TEXT[asDoc(row)[s.key] ?? '']
                    ? '·' + STAGE_TEXT[asDoc(row)[s.key] ?? '']
                    : ''
                }}
              </span>
            </div>
            <p
              v-if="asDoc(row).errorMessage"
              class="doc__err"
              :title="asDoc(row).errorMessage ?? ''"
            >
              {{ asDoc(row).errorMessage }}
            </p>
          </template>
        </el-table-column>

        <el-table-column label="上传时间" width="150">
          <template #default="{ row }">{{ formatDateTime(asDoc(row).createdAt) }}</template>
        </el-table-column>

        <el-table-column label="操作" :width="kb?.isSystem === 1 ? 90 : 190" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="kb?.isSystem !== 1 && asDoc(row).status === 'FAILED'"
              size="small"
              text
              type="primary"
              :icon="Refresh"
              :loading="acting === asDoc(row).documentId"
              @click="onRetry(asDoc(row))"
            >
              重试
            </el-button>
            <el-button size="small" text :icon="Download" @click="onDownload(asDoc(row))"
              >下载</el-button
            >
            <el-button
              v-if="kb?.isSystem !== 1"
              size="small"
              text
              type="danger"
              :icon="Delete"
              @click="onRemove(asDoc(row))"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="empty"
        :image-size="80"
        :description="kb?.isSystem === 1 ? '该官方智库暂无文档' : '还没有文档，点右上角上传 —— 支持 PDF / Word / 文本 / Markdown'"
      />

      <el-pagination
        v-if="total > query.pageSize"
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        class="pane__pager"
        @change="() => load()"
      />
    </section>

    <KnowledgeBaseDialog v-model="dialogVisible" :kb="kb" @saved="load" />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-5);
  max-width: 1080px;
  margin: 0 auto;
}

/* ---------- 头部 ---------- */
.head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-4);
  align-items: center;
}

.head__main {
  flex: 1;
  min-width: 0;
}

.head__title-row {
  display: flex;
  align-items: center;
  gap: var(--mf-space-2);
  margin-bottom: var(--mf-space-1);
}

.head__title {
  margin: 0;
  font-size: var(--mf-font-xl);
  font-weight: var(--mf-weight-medium);
  letter-spacing: -0.02em;
}

.head__meta {
  margin: 0;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
}

.head__actions {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
}

/* ---------- 统计 ---------- */
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--mf-space-4);
}

@media (width <= 640px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--mf-space-4);
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
}

.stat__n {
  font-size: var(--mf-font-xl);
  font-weight: var(--mf-weight-medium);
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.stat__n--ok {
  color: var(--mf-success-text);
}

.stat__n--bad {
  color: var(--mf-danger-text);
}

.stat__t {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

/* ---------- 面板 ---------- */
.pane {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-4);
  padding: var(--mf-space-5);
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
}

.pane__head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-4);
  align-items: center;
  justify-content: space-between;
}

.pane__title {
  margin: 0;
  font-size: var(--mf-font-md);
  font-weight: var(--mf-weight-medium);
}

.pane__actions {
  display: flex;
  gap: var(--mf-space-3);
  align-items: center;
}

/* 原生文件选择器藏起来，点击由「上传文档」按钮转发 */
.pane__file {
  display: none;
}

.pane__pager {
  justify-content: flex-end;
}

/* ---------- 自动刷新指示 ---------- */
.refresh {
  display: inline-flex;
  gap: var(--mf-space-2);
  align-items: center;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
}

.refresh__dot {
  width: 6px;
  height: 6px;
  background-color: var(--mf-text-tertiary);
  border-radius: 50%;
}

.refresh__dot--on {
  background-color: var(--mf-primary);
  animation: pulse 1.6s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .refresh__dot--on {
    animation: none;
  }
}

/* ---------- 表格单元 ---------- */
.doc__name {
  font-size: var(--mf-font-sm);
}

.doc__size {
  margin-left: var(--mf-space-2);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.doc__err {
  margin: var(--mf-space-1) 0 0;
  overflow: hidden;
  font-size: var(--mf-font-xs);
  color: var(--mf-danger-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stages {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-1);
}

.stage {
  padding: 0 var(--mf-space-2);
  font-size: var(--mf-font-xs);
  line-height: 18px;
  color: var(--mf-text-tertiary);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-pill);
}

.stage--run {
  color: var(--mf-warning-text);
  background-color: var(--mf-warning-subtle);
}

.stage--ok {
  color: var(--mf-success-text);
  background-color: var(--mf-success-subtle);
}

.stage--bad {
  color: var(--mf-danger-text);
  background-color: var(--mf-danger-subtle);
}

/* ---------- 状态标签 ---------- */
.tag {
  display: inline-block;
  padding: 0 var(--mf-space-2);
  font-size: var(--mf-font-xs);
  line-height: 20px;
  white-space: nowrap;
  border-radius: var(--mf-radius-pill);
}

.tag--neutral {
  color: var(--mf-text-secondary);
  background-color: var(--mf-bg-subtle);
}

.tag--warning {
  color: var(--mf-warning-text);
  background-color: var(--mf-warning-subtle);
}

.tag--success {
  color: var(--mf-success-text);
  background-color: var(--mf-success-subtle);
}

.tag--danger {
  color: var(--mf-danger-text);
  background-color: var(--mf-danger-subtle);
}

.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--mf-space-2) var(--mf-space-4);
  margin-bottom: var(--mf-space-3);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: var(--mf-radius-md);
}

.batch-bar__tip {
  font-size: var(--mf-font-size-sm);
  color: var(--el-text-color-primary);
}

.batch-bar__tip strong {
  color: var(--el-color-primary);
}

.batch-bar__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--mf-space-2);
}
</style>
