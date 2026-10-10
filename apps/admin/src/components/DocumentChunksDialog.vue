<script setup lang="ts">
import { ref, watch } from 'vue'

import type { AdminDocumentVO, ChunkVO } from '@mindforge/shared'
import { BizError } from '@mindforge/shared'

import { documentApi } from '@/api/document'
import { formatBytes } from '@/utils/format'

const visible = defineModel<boolean>({ required: true })

const props = defineProps<{
  /** 要看分块的文档；null = 弹窗关闭中 */
  doc: AdminDocumentVO | null
}>()

const loading = ref(false)
const rows = ref<ChunkVO[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

/** el-table 插槽的 row 是 `DefaultRow`，转成我们的类型 */
function asChunk(row: unknown): ChunkVO {
  return row as ChunkVO
}

/**
 * 展示用的序号（从 1 开始）。
 * ⚠️ 别写成 `chunkIndex + 1` —— chunkIndex 后端是 Integer（可空），
 *    空值会算成 `null + 1 = 1`，序号静默显示成「1」而不是「-」。
 */
function chunkNo(row: unknown): string {
  const i = asChunk(row).chunkIndex
  return i === null ? '-' : String(i + 1)
}

/**
 * 分块列表是排查「RAG 为什么没召回到」的工具 ——
 * 看正文有没有被正确切分、token 数是否合理、页码能不能对回原文。
 */
async function load(): Promise<void> {
  if (!props.doc) return
  loading.value = true
  try {
    const data = await documentApi.chunks(props.doc.documentId, {
      page: page.value,
      pageSize: pageSize.value,
    })
    rows.value = data.records
    total.value = data.total
  } catch (e) {
    fail(e, '分块加载失败')
  } finally {
    loading.value = false
  }
}

/** 列表里只放内容开头一小截，全文放展开行 —— tooltip 放长文很难读 */
function preview(content: string): string {
  return content.length > 60 ? content.slice(0, 60) + '…' : content
}

watch(visible, (open) => {
  if (open) {
    page.value = 1
    void load()
  }
})
</script>

<template>
  <!-- ★ 在 el-card 里渲染的弹窗必须 append-to-body（backdrop-filter 的包含块坑） -->
  <el-dialog
    v-model="visible"
    :title="doc ? `分块查看 · ${doc.fileName}` : '分块查看'"
    width="760px"
    append-to-body
  >
    <div v-if="doc" class="meta">
      {{ doc.fileType || '-' }} · {{ formatBytes(doc.fileSize) }}
      <template v-if="doc.pageCount !== null"> · {{ doc.pageCount }} 页</template>
      · 共 {{ total }} 块
    </div>

    <el-table v-loading="loading" :data="rows" border>
      <el-table-column type="expand">
        <template #default="{ row }">
          <pre class="chunk-full">{{ asChunk(row).content }}</pre>
        </template>
      </el-table-column>
      <el-table-column label="#" width="60" align="center">
        <template #default="{ row }">{{ chunkNo(row) }}</template>
      </el-table-column>
      <el-table-column label="内容" min-width="380">
        <template #default="{ row }">
          <span class="chunk-preview">{{ preview(asChunk(row).content) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="Token" width="80" align="center">
        <template #default="{ row }">{{ asChunk(row).tokenCount }}</template>
      </el-table-column>
      <el-table-column label="页码" width="70" align="center">
        <template #default="{ row }">{{ asChunk(row).pageNo ?? '-' }}</template>
      </el-table-column>
      <template #empty>这篇文档还没有分块</template>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next"
      class="pagination"
      @change="() => load()"
    />
  </el-dialog>
</template>

<style scoped>
.meta {
  margin-bottom: var(--mf-space-3);
  font-size: var(--mf-font-sm);
  color: var(--mf-text-secondary);
}

.chunk-preview {
  color: var(--mf-text-secondary);
}

/* pre 才能保留分块正文里的换行 —— RAG 切分质量就看这个 */
.chunk-full {
  max-height: 240px;
  padding: var(--mf-space-3);
  margin: 0;
  overflow-y: auto;
  font-family: var(--mf-font-mono, ui-monospace, monospace);
  font-size: var(--mf-font-xs);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--mf-text-secondary);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-sm);
}

.pagination {
  justify-content: flex-end;
  margin-top: var(--mf-space-3);
}
</style>
