<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'

import type { AdminDocumentVO, AdminKnowledgeBaseVO } from '@mindforge/shared'
import { BizError } from '@mindforge/shared'

import { documentApi } from '@/api/document'
import { knowledgeApi } from '@/api/knowledge'
import DocumentChunksDialog from '@/components/DocumentChunksDialog.vue'
import DocumentStatusDialog from '@/components/DocumentStatusDialog.vue'
import StatusTag from '@/components/StatusTag.vue'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/format'

const auth = useAuthStore()
const route = useRoute()

const loading = ref(false)
const rows = ref<AdminDocumentVO[]>([])
const total = ref(0)

/**
 * 查询条件。
 *
 * ⚠️ `status` / `knowledgeBaseId` 用 `undefined` 表示「不筛」，不能用 0 ——
 * 0 会原样发给后端变成一个真实条件。
 */
const query = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  knowledgeBaseId: undefined as number | undefined,
  status: undefined as string | undefined,
  sortBy: undefined as string | undefined,
  sortOrder: undefined as 'asc' | 'desc' | undefined,
})

// 知识库页点「文档」跳过来会带 `?kbId=xxx` —— 进来就是筛好的
const kbIdFromRoute = Number(route.query.kbId)
if (Number.isFinite(kbIdFromRoute) && kbIdFromRoute > 0) {
  query.knowledgeBaseId = kbIdFromRoute
}

/**
 * 聚合总状态的取值与配色。
 *
 * ⚠️ 来源是后端 `DocumentStatusUtils.aggregate()`，不是猜的：
 * 失败优先（任一段 FAILED 整体 FAILED），然后按推进最远的一段给
 * COMPLETED / CHUNKED / PARSED，正在解析给 PARSING，否则 UPLOADED。
 */
const STATUS_TEXT: Record<string, string> = {
  UPLOADED: '已上传',
  PARSING: '解析中',
  PARSED: '已解析',
  CHUNKED: '已分块',
  COMPLETED: '已完成',
  FAILED: '失败',
}

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const STATUS_TONE: Record<string, Tone> = {
  UPLOADED: 'neutral',
  PARSING: 'warning',
  PARSED: 'info',
  CHUNKED: 'info',
  COMPLETED: 'success',
  FAILED: 'danger',
}

/** 三段状态展示用的固定顺序（后端字段也是这个顺序推进的） */
const STAGES = [
  { key: 'parseStatus', label: '解析' },
  { key: 'chunkStatus', label: '分块' },
  { key: 'vectorStatus', label: '向量' },
] as const

const STAGE_TEXT: Record<string, string> = {
  PENDING: '等待',
  PARSING: '解析中',
  CHUNKING: '分块中',
  EMBEDDING: '嵌入中',
  SUCCESS: '完成',
  FAILED: '失败',
}

const STAGE_TONE: Record<string, Tone> = {
  PENDING: 'neutral',
  PARSING: 'warning',
  CHUNKING: 'warning',
  EMBEDDING: 'warning',
  SUCCESS: 'success',
  FAILED: 'danger',
}

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

/** el-table 插槽的 row 是 `DefaultRow`，转成我们的类型 —— 理由同用户列表页 */
function asDoc(row: unknown): AdminDocumentVO {
  return row as AdminDocumentVO
}

/**
 * @param silent 静默刷新：不显示 loading 遮罩。
 *   自动轮询必须用这个 —— 否则每 5 秒整个表格闪一下，比不刷新还烦。
 */
async function load(options: { silent?: boolean } = {}): Promise<void> {
  const { silent = false } = options
  if (!silent) loading.value = true
  try {
    /**
     * 知识库 ID 输入框绑的是 `v-model.number`，但**清空后运行时值是空串**不是 undefined
     * （.number 对空串不做转换）。不挡一下的话会拼出 `knowledgeBaseId=` 发给后端。
     */
    const kbId = query.knowledgeBaseId
    const data = await documentApi.page({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined,
      knowledgeBaseId: typeof kbId === 'number' && Number.isFinite(kbId) ? kbId : undefined,
      status: query.status,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    })
    rows.value = data.records
    total.value = data.total
  } catch (e) {
    // 静默轮询失败不弹提示 —— 网络抖一下就弹一个红框太吵，
    // 而且下一轮（5 秒后）自己会重试。真正的失败用户会从数据没变上看出来。
    if (!silent) fail(e, '加载失败')
  } finally {
    if (!silent) loading.value = false
  }
}

/**
 * 这条文档还在处理中吗？
 *
 * ⚠️ 判断依据是**三段子状态**（解析 / 分块 / 向量），不是总状态：
 *    总状态 `UPLOADED` 只表示「还没开始」，这时候后端队列已经排上了，
 *    也应该继续刷 —— 否则用户上传完盯着看，界面永远不动。
 *
 * 取值范围来自后端 `DocumentStatusUtils.aggregate()`，不是猜的。
 */
const IN_PROGRESS = ['PENDING', 'PARSING', 'CHUNKING', 'EMBEDDING']

function isProcessing(row: AdminDocumentVO): boolean {
  // 总状态还在「已上传 / 解析中」说明整条流水线没走完
  if (row.status === 'UPLOADED' || row.status === 'PARSING') return true
  // 任一段在跑就还没完
  return STAGES.some((s) => IN_PROGRESS.includes(row[s.key] ?? ''))
}

const {
  enabled: autoRefresh,
  active: refreshing,
  exhausted,
  resume,
} = useAutoRefresh({
  shouldContinue: () => rows.value.some(isProcessing),
  onRefresh: () => load({ silent: true }),
})

function onSearch(): void {
  query.page = 1
  void load()
}

function onReset(): void {
  query.keyword = ''
  query.knowledgeBaseId = undefined
  query.status = undefined
  query.sortBy = undefined
  query.sortOrder = undefined
  onSearch()
}

function onSortChange(data: { prop?: string | null; order?: string | null }): void {
  if (!data.order || !data.prop) {
    query.sortBy = undefined
    query.sortOrder = undefined
  } else {
    query.sortBy = data.prop
    query.sortOrder = data.order === 'ascending' ? 'asc' : 'desc'
  }
  query.page = 1
  void load()
}

// ---------- 弹窗 ----------
const chunksVisible = ref(false)
const chunksDoc = ref<AdminDocumentVO | null>(null)

const statusVisible = ref(false)
const statusDoc = ref<AdminDocumentVO | null>(null)

function onChunks(row: AdminDocumentVO): void {
  chunksDoc.value = row
  chunksVisible.value = true
}

function onFixStatus(row: AdminDocumentVO): void {
  statusDoc.value = row
  statusVisible.value = true
}

/**
 * 重新走一遍解析流水线。恢复性操作（不破坏数据，失败了顶多原地不动），
 * 按危险操作的原则不加二次确认。
 */
async function onRetry(row: AdminDocumentVO): Promise<void> {
  try {
    await documentApi.retry(row.documentId)
    ElMessage.success('已重新提交处理')
    await load()
  } catch (e) {
    fail(e, '重试失败')
  }
}

async function onDelete(row: AdminDocumentVO): Promise<void> {
  const ok = await ElMessageBox.confirm(
    `删除文档「${row.fileName}」后不可恢复，对应的分块和向量索引也会清理。确定删除吗？`,
    '删除确认',
    { type: 'warning', confirmButtonText: '删除' },
  ).catch(() => false)
  if (!ok) return

  try {
    await documentApi.remove(row.documentId)
    ElMessage.success('已删除')
    if (rows.value.length === 1 && query.page > 1) query.page -= 1
    await load()
  } catch (e) {
    fail(e, '删除失败')
  }
}

// ---------- 批量操作 ----------
const selectedRows = ref<AdminDocumentVO[]>([])
const tableRef = ref()

function onSelectionChange(selection: AdminDocumentVO[]): void {
  selectedRows.value = selection
}

function clearSelection(): void {
  tableRef.value?.clearSelection()
  selectedRows.value = []
}

async function onBatchRetry(): Promise<void> {
  if (!selectedRows.value.length) return
  const ids = selectedRows.value.map((r) => r.documentId)
  try {
    const count = await documentApi.batchRetry({ ids })
    ElMessage.success(`已重新提交 ${count} 篇文档进入处理流水线`)
    clearSelection()
    await load()
  } catch (e) {
    fail(e, '批量重试失败')
  }
}

async function onBatchDelete(): Promise<void> {
  if (!selectedRows.value.length) return
  const ids = selectedRows.value.map((r) => r.documentId)
  const ok = await ElMessageBox.confirm(
    `删除后不可恢复，对应文档的分块与向量索引也将一并清理。确定批量删除选中的 ${ids.length} 篇文档吗？`,
    '高危操作确认',
    { type: 'warning', confirmButtonText: '删除' },
  ).catch(() => false)
  if (!ok) return

  try {
    const count = await documentApi.batchRemove({ ids })
    ElMessage.success(`已批量删除 ${count} 篇文档`)
    clearSelection()
    await load()
  } catch (e) {
    fail(e, '批量删除失败')
  }
}

// ---------- 知识库下拉选项 ----------
const kbOptions = ref<AdminKnowledgeBaseVO[]>([])
async function loadKbOptions(): Promise<void> {
  try {
    const data = await knowledgeApi.page({ page: 1, pageSize: 100 })
    kbOptions.value = data.records
  } catch {
    // ignore
  }
}

// ---------- 上传文档弹窗 ----------
const uploadVisible = ref(false)
const uploadSubmitting = ref(false)
const uploadForm = reactive({
  knowledgeBaseId: undefined as string | number | undefined,
  file: null as File | null,
  description: '',
})

function openUploadDialog(): void {
  uploadForm.knowledgeBaseId = query.knowledgeBaseId || kbOptions.value[0]?.id
  uploadForm.file = null
  uploadForm.description = ''
  uploadVisible.value = true
  void loadKbOptions()
}

function onFileChange(uploadFile: { raw?: File }): void {
  uploadForm.file = uploadFile.raw ?? null
}

async function submitUpload(): Promise<void> {
  if (!uploadForm.knowledgeBaseId) {
    ElMessage.warning('请选择目标知识库')
    return
  }
  if (!uploadForm.file) {
    ElMessage.warning('请选择要上传的文件')
    return
  }
  uploadSubmitting.value = true
  try {
    await documentApi.upload(
      String(uploadForm.knowledgeBaseId),
      uploadForm.file,
      uploadForm.description.trim() || undefined,
    )
    ElMessage.success('上传成功，已提交异步解析向量化流水线')
    uploadVisible.value = false
    await load()
  } catch (e) {
    fail(e, '上传失败')
  } finally {
    uploadSubmitting.value = false
  }
}

// ---------- 导入网页弹窗 ----------
const importUrlVisible = ref(false)
const importUrlSubmitting = ref(false)
const importUrlForm = reactive({
  knowledgeBaseId: undefined as string | number | undefined,
  url: '',
})

function openImportUrlDialog(): void {
  importUrlForm.knowledgeBaseId = query.knowledgeBaseId || kbOptions.value[0]?.id
  importUrlForm.url = ''
  importUrlVisible.value = true
  void loadKbOptions()
}

async function submitImportUrl(): Promise<void> {
  if (!importUrlForm.knowledgeBaseId) {
    ElMessage.warning('请选择目标知识库')
    return
  }
  const url = importUrlForm.url.trim()
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    ElMessage.warning('请输入以 http:// 或 https:// 开头的合法网页链接')
    return
  }
  importUrlSubmitting.value = true
  try {
    await documentApi.importUrl(String(importUrlForm.knowledgeBaseId), { url })
    ElMessage.success('网页正文提取成功，并已生成 Markdown 入库开始解析！')
    importUrlVisible.value = false
    await load()
  } catch (e) {
    fail(e, '导入网页文章失败')
  } finally {
    importUrlSubmitting.value = false
  }
}

onMounted(() => {
  void load()
  void loadKbOptions()
})
</script>

<template>
  <el-card shadow="never">
    <div class="filters">
      <el-input
        v-model="query.keyword"
        placeholder="文件名"
        clearable
        class="filters__input"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-input
        v-model.number="query.knowledgeBaseId"
        placeholder="知识库 ID"
        class="filters__kb"
        @keyup.enter="onSearch"
      />
      <el-select v-model="query.status" placeholder="总状态" clearable class="filters__select">
        <el-option v-for="(text, value) in STATUS_TEXT" :key="value" :label="text" :value="value" />
      </el-select>
      <el-button type="primary" @click="onSearch">查询</el-button>
      <el-button @click="onReset">重置</el-button>
      <el-button type="success" @click="openUploadDialog">+ 上传文档</el-button>
      <el-button type="primary" plain @click="openImportUrlDialog">🌐 导入网页</el-button>

      <!--
        自动刷新开关。
        文档的解析/分块/向量都是后端异步跑的，光靠手动点「查询」根本不知道
        什么时候好 —— 所以只要有文档在处理中就自动刷（默认开）。
        没有处理中的时候开关自动置灰：这时候刷也是白刷。
      -->
      <span class="auto">
        <el-switch v-model="autoRefresh" size="small" :disabled="exhausted" />
        <span class="auto__text" :class="{ 'auto__text--on': refreshing }">
          {{ exhausted ? '自动刷新已暂停' : refreshing ? '自动刷新中' : '自动刷新' }}
        </span>
        <el-button v-if="exhausted" link type="primary" @click="resume">继续</el-button>
      </span>
    </div>

    <div v-if="selectedRows.length > 0" class="batch-bar">
      <span class="batch-bar__tip">
        已选择 <strong>{{ selectedRows.length }}</strong> 篇文档
      </span>
      <div class="batch-bar__actions">
        <el-button
          v-if="auth.can('admin:document:retry')"
          type="warning"
          size="small"
          @click="onBatchRetry"
        >
          批量重试
        </el-button>
        <el-button
          v-if="auth.can('admin:document:delete')"
          type="danger"
          size="small"
          @click="onBatchDelete"
        >
          批量删除
        </el-button>
        <el-button link size="small" @click="clearSelection">取消选择</el-button>
      </div>
    </div>

    <!-- 列宽合计 1033px，最窄视口（1366）下内容区约 1040px。改列宽重新加一遍总数 -->
    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="rows"
      border
      stripe
      @selection-change="onSelectionChange"
      @sort-change="onSortChange"
    >
      <el-table-column type="selection" width="48" align="center" />
      <el-table-column
        prop="fileName"
        label="文件名"
        min-width="150"
        sortable="custom"
        show-overflow-tooltip
      />
      <el-table-column label="知识库" min-width="110" show-overflow-tooltip>
        <template #default="{ row }">{{ asDoc(row).knowledgeBaseName || '-' }}</template>
      </el-table-column>
      <el-table-column label="归属人" width="90">
        <template #default="{ row }">{{ asDoc(row).username || '-' }}</template>
      </el-table-column>
      <el-table-column label="总状态" width="95" align="center">
        <template #default="{ row }">
          <StatusTag :tone="STATUS_TONE[asDoc(row).status] ?? 'neutral'">
            {{ STATUS_TEXT[asDoc(row).status] ?? asDoc(row).status }}
          </StatusTag>
        </template>
      </el-table-column>
      <el-table-column label="处理进度" min-width="165">
        <template #default="{ row }">
          <span class="stages">
            <!-- title 里放原始值：排查时要把后端字段值报给后端，光看中文对不上 -->
            <StatusTag
              v-for="stage in STAGES"
              :key="stage.key"
              :tone="STAGE_TONE[asDoc(row)[stage.key] ?? ''] ?? 'neutral'"
              :title="`${stage.label}：${asDoc(row)[stage.key] ?? 'null'}`"
            >
              {{ STAGE_TEXT[asDoc(row)[stage.key] ?? ''] ?? '—' }}
            </StatusTag>
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="145" sortable="custom">
        <template #default="{ row }">{{ formatDateTime(asDoc(row).createdAt) }}</template>
      </el-table-column>

      <el-table-column label="操作" width="230" fixed="right">
        <template #default="{ row }">
          <span class="actions">
            <el-button link type="primary" @click="onChunks(asDoc(row))">分块</el-button>
            <el-button
              v-if="auth.can('admin:document:update')"
              link
              type="primary"
              @click="onFixStatus(asDoc(row))"
            >
              修正
            </el-button>
            <el-button
              v-if="auth.can('admin:document:retry')"
              link
              type="warning"
              @click="onRetry(asDoc(row))"
            >
              重试
            </el-button>
            <el-button
              v-if="auth.can('admin:document:delete')"
              link
              type="danger"
              @click="onDelete(asDoc(row))"
            >
              删除
            </el-button>
          </span>
        </template>
      </el-table-column>

      <template #empty>没有匹配的文档</template>
    </el-table>

    <el-pagination
      v-model:current-page="query.page"
      v-model:page-size="query.pageSize"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next"
      class="pagination"
      @change="() => load()"
    />

    <DocumentChunksDialog v-model="chunksVisible" :doc="chunksDoc" />
    <DocumentStatusDialog v-model="statusVisible" :doc="statusDoc" @saved="() => load()" />

    <!-- 上传文档弹窗 -->
    <!-- ★ 在 el-card 里渲染的弹窗必须 append-to-body（backdrop-filter 与 overflow:hidden 会导致裁剪） -->
    <el-dialog
      v-model="uploadVisible"
      title="上传文档到知识库"
      width="540px"
      append-to-body
      align-center
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="目标知识库" required>
          <el-select
            v-model="uploadForm.knowledgeBaseId"
            placeholder="请选择知识库"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="kb in kbOptions"
              :key="kb.id"
              :label="`${kb.name} (${kb.username || '官方'})`"
              :value="kb.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="文档文件" required>
          <el-upload
            action="#"
            :auto-upload="false"
            :limit="1"
            accept=".pdf,.docx,.txt,.md,.markdown,.html,.htm"
            :on-change="onFileChange"
          >
            <template #trigger>
              <el-button type="primary">选择文件</el-button>
            </template>
            <template #tip>
              <div class="el-upload__tip">
                支持 PDF / DOCX / TXT / Markdown / HTML 格式文档
              </div>
            </template>
          </el-upload>
        </el-form-item>
        <el-form-item label="文档说明">
          <el-input
            v-model="uploadForm.description"
            placeholder="可选：备注信息"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="uploadSubmitting" @click="uploadVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploadSubmitting" @click="submitUpload">
          开始上传
        </el-button>
      </template>
    </el-dialog>

    <!-- 导入网页文章弹窗 -->
    <!-- ★ 在 el-card 里渲染的弹窗必须 append-to-body（backdrop-filter 与 overflow:hidden 会导致裁剪） -->
    <el-dialog
      v-model="importUrlVisible"
      title="从网页 URL 一键导入文章"
      width="560px"
      append-to-body
      align-center
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="目标知识库" required>
          <el-select
            v-model="importUrlForm.knowledgeBaseId"
            placeholder="请选择知识库"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="kb in kbOptions"
              :key="kb.id"
              :label="`${kb.name} (${kb.username || '官方'})`"
              :value="kb.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="网页文章 URL" required>
          <el-input
            v-model="importUrlForm.url"
            placeholder="例如：https://example.com/article"
            clearable
          />
          <div class="import-tip">
            💡 系统将调用原生网页提取引擎，自动去除广告、导航等干扰，精准提取正文并转换为 Markdown 入库。
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="importUrlSubmitting" @click="importUrlVisible = false">取消</el-button>
        <el-button type="primary" :loading="importUrlSubmitting" @click="submitImportUrl">
          提取并入库
        </el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.import-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 6px;
  line-height: 1.5;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-3);
  margin-bottom: var(--mf-space-4);
}

.filters__input {
  width: 220px;
}

.filters__kb {
  width: 130px;
}

.filters__select {
  width: 130px;
}

/* 自动刷新开关 —— margin-left:auto 把它推到工具栏最右，不跟筛选条件挤在一起 */
.auto {
  display: inline-flex;
  gap: var(--mf-space-2);
  align-items: center;
  margin-left: auto;
}

.auto__text {
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
}

/* 正在刷的时候点亮 + 呼吸，让「数据是活的」这件事看得见 */
.auto__text--on {
  color: var(--mf-primary-text);
  animation: auto-pulse 1.6s ease-in-out infinite;
}

@keyframes auto-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

/* 系统设了「减少动态效果」就别呼吸了，静态变色足够表达状态 */
@media (prefers-reduced-motion: reduce) {
  .auto__text--on {
    animation: none;
  }
}

/* 三个阶段标签一行排不下时允许折行 —— 行高变化比塞不下强 */
.stages {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--mf-space-1);
}

.actions {
  display: inline-flex;
  gap: var(--mf-space-2);
  white-space: nowrap;
}

.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--mf-space-2) var(--mf-space-4);
  margin-bottom: var(--mf-space-4);
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

.pagination {
  justify-content: flex-end;
  margin-top: var(--mf-space-4);
}
</style>
