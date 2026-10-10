<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'

import type { AdminDocumentVO } from '@mindforge/shared'
import { BizError } from '@mindforge/shared'

import { documentApi } from '@/api/document'
import DocumentChunksDialog from '@/components/DocumentChunksDialog.vue'
import DocumentStatusDialog from '@/components/DocumentStatusDialog.vue'
import StatusTag from '@/components/StatusTag.vue'
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

async function load(): Promise<void> {
  loading.value = true
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
    })
    rows.value = data.records
    total.value = data.total
  } catch (e) {
    fail(e, '加载失败')
  } finally {
    loading.value = false
  }
}

function onSearch(): void {
  query.page = 1
  void load()
}

function onReset(): void {
  query.keyword = ''
  query.knowledgeBaseId = undefined
  query.status = undefined
  onSearch()
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

onMounted(load)
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
    </div>

    <!-- 列宽合计 985px，最窄视口（1366）下内容区约 1040px。改列宽重新加一遍总数 -->
    <el-table v-loading="loading" :data="rows" border stripe>
      <el-table-column prop="fileName" label="文件名" min-width="150" show-overflow-tooltip />
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
      <el-table-column label="创建时间" width="145">
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
      @change="load"
    />

    <DocumentChunksDialog v-model="chunksVisible" :doc="chunksDoc" />
    <DocumentStatusDialog v-model="statusVisible" :doc="statusDoc" @saved="load" />
  </el-card>
</template>

<style scoped>
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

.pagination {
  justify-content: flex-end;
  margin-top: var(--mf-space-4);
}
</style>
