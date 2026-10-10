<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { AdminKnowledgeBaseVO } from '@mindforge/shared'
import { BizError } from '@mindforge/shared'

import { knowledgeApi } from '@/api/knowledge'
import StatusTag from '@/components/StatusTag.vue'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime } from '@/utils/format'

const auth = useAuthStore()
const router = useRouter()

const loading = ref(false)
const rows = ref<AdminKnowledgeBaseVO[]>([])
const total = ref(0)

/**
 * 查询条件。
 *
 * ⚠️ `status` 用 `undefined` 表示「不筛」，**不能用 0** ——
 * 0 是有意义的取值（禁用）。理由同用户列表页。
 */
const query = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  status: undefined as number | undefined,
})

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

/** el-table 插槽的 row 是 `DefaultRow`，转成我们的类型 —— 理由同用户列表页 */
function asKb(row: unknown): AdminKnowledgeBaseVO {
  return row as AdminKnowledgeBaseVO
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await knowledgeApi.page({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined,
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
  // 换条件要回到第一页 —— 否则可能停在新结果集里不存在的页码上
  query.page = 1
  void load()
}

function onReset(): void {
  query.keyword = ''
  query.status = undefined
  onSearch()
}

/**
 * 去看这个库下的文档 —— 文档页支持 `kbId` 查询参数，进来就是筛好的。
 * 没有文档查看权限的人不显示这个入口（跳过去也是 403）。
 */
function onDocuments(row: AdminKnowledgeBaseVO): void {
  void router.push({ name: 'documents', query: { kbId: row.id } })
}

async function onDelete(row: AdminKnowledgeBaseVO): Promise<void> {
  const ok = await ElMessageBox.confirm(
    `删除知识库「${row.name}」后，其中的 ${row.documentCount} 篇文档也会一起删除。` +
      '向量索引由后台异步清理，删完短时间内仍会占用空间。确定删除吗？',
    '删除确认',
    { type: 'warning', confirmButtonText: '删除' },
  ).catch(() => false)
  if (!ok) return

  try {
    await knowledgeApi.remove(row.id)
    ElMessage.success('已删除，向量索引将在后台清理')
    // 删掉当前页最后一条时要往前退一页，否则会停在一张空页上
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
        placeholder="知识库名称"
        clearable
        class="filters__input"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-select v-model="query.status" placeholder="状态" clearable class="filters__select">
        <el-option label="启用" :value="1" />
        <el-option label="禁用" :value="0" />
      </el-select>
      <el-button type="primary" @click="onSearch">查询</el-button>
      <el-button @click="onReset">重置</el-button>
    </div>

    <!-- 列宽合计 805px，最窄视口（1366）下内容区约 1040px，留有余量 -->
    <el-table v-loading="loading" :data="rows" border stripe>
      <el-table-column prop="name" label="名称" min-width="140" />
      <el-table-column label="归属人" min-width="90">
        <template #default="{ row }">{{ asKb(row).username || '-' }}</template>
      </el-table-column>
      <el-table-column label="描述" min-width="160">
        <template #default="{ row }">{{ asKb(row).description || '-' }}</template>
      </el-table-column>
      <el-table-column label="文档数" width="80" align="center">
        <template #default="{ row }">{{ asKb(row).documentCount }}</template>
      </el-table-column>
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <StatusTag :tone="asKb(row).status === 1 ? 'success' : 'danger'">
            {{ asKb(row).status === 1 ? '启用' : '禁用' }}
          </StatusTag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="145">
        <template #default="{ row }">{{ formatDateTime(asKb(row).updatedAt) }}</template>
      </el-table-column>

      <el-table-column label="操作" width="110" fixed="right">
        <template #default="{ row }">
          <span class="actions">
            <el-button
              v-if="auth.can('admin:document:list')"
              link
              type="primary"
              @click="onDocuments(asKb(row))"
            >
              文档
            </el-button>
            <el-button
              v-if="auth.can('admin:knowledge:delete')"
              link
              type="danger"
              @click="onDelete(asKb(row))"
            >
              删除
            </el-button>
          </span>
        </template>
      </el-table-column>

      <template #empty>没有匹配的知识库</template>
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
  </el-card>
</template>

<style scoped>
.filters {
  display: flex;
  gap: var(--mf-space-3);
  margin-bottom: var(--mf-space-4);
}

.filters__input {
  width: 240px;
}

.filters__select {
  width: 140px;
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
