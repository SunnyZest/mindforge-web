<script setup lang="ts">
import { Plus, MagicStick, Edit, Delete, Briefcase } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { BizError, formatDateTime, type JobVO } from '@mindforge/shared'

import { jobApi } from '@/api/job'
import JobFormDialog from '@/components/JobFormDialog.vue'
import JobKanbanBoard from '@/components/JobKanbanBoard.vue'

const router = useRouter()

const viewMode = ref<'grid' | 'kanban'>('kanban')
const kanbanRef = ref<InstanceType<typeof JobKanbanBoard> | null>(null)

const loading = ref(false)
const rows = ref<JobVO[]>([])
const total = ref(0)
const query = reactive({ page: 1, pageSize: 12, keyword: '' })

/** 正在解析的职位 id —— 解析是【同步接口】，可能要等几十秒 */
const parsing = ref<string | null>(null)

const formVisible = ref(false)
const formJob = ref<JobVO | null>(null)

const STATUS_TEXT: Record<string, string> = {
  PENDING: '待解析',
  PARSING: '解析中',
  SUCCESS: '已解析',
  FAILED: '解析失败',
}

const STATUS_TONE: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  PENDING: 'neutral',
  PARSING: 'warning',
  SUCCESS: 'success',
  FAILED: 'danger',
}

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await jobApi.page({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined,
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
  if (viewMode.value === 'kanban') {
    void kanbanRef.value?.refresh()
  } else {
    query.page = 1
    void load()
  }
}

async function onJobSaved(): Promise<void> {
  await load()
  if (viewMode.value === 'kanban') {
    void kanbanRef.value?.refresh()
  }
}

function onCreate(): void {
  formJob.value = null
  formVisible.value = true
}

function onEdit(row: JobVO): void {
  formJob.value = row
  formVisible.value = true
}

/**
 * 解析。
 *
 * ⚠️ 和简历那边不同 —— 职位的解析是**同步接口**：请求会一直挂到模型出结果
 *    （几十秒），然后直接把解析后的详情返回。所以这里不能用轮询，
 *    只能老老实实等，界面上要给个明确的「正在等」状态。
 */
async function onParse(row: JobVO): Promise<void> {
  parsing.value = row.id
  try {
    await jobApi.parse(row.id)
    ElMessage.success('解析完成')
    await load()
  } catch (e) {
    fail(e, '解析失败')
    // 失败时后端会把 parseStatus 置成 FAILED 并记下原因，刷新一下让用户看到
    await load()
  } finally {
    parsing.value = null
  }
}

async function onRemove(row: JobVO): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除职位「${row.title}」？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return // 用户取消
  }

  try {
    await jobApi.remove(row.id)
    ElMessage.success('已删除')
    // 删的是本页最后一条时要回退一页，否则会停在空页上
    if (rows.value.length === 1 && query.page > 1) query.page -= 1
    await load()
  } catch (e) {
    fail(e, '删除失败')
  }
}

// ---------- 批量管理 ----------
const batchMode = ref(false)
const selectedIds = ref<string[]>([])
const batchDeleting = ref(false)

function toggleBatchMode(): void {
  batchMode.value = !batchMode.value
  if (!batchMode.value) {
    selectedIds.value = []
  }
}

function toggleSelect(id: string, checked?: boolean): void {
  const isChecked = checked ?? !selectedIds.value.includes(id)
  if (isChecked) {
    if (!selectedIds.value.includes(id)) {
      selectedIds.value.push(id)
    }
  } else {
    selectedIds.value = selectedIds.value.filter((i) => i !== id)
  }
}

function onCardCheck(id: string, val: unknown): void {
  toggleSelect(id, Boolean(val))
}

function selectAll(): void {
  selectedIds.value = rows.value.map((j) => j.id)
}

function clearSelection(): void {
  selectedIds.value = []
}

async function onBatchDelete(): Promise<void> {
  if (!selectedIds.value.length) return
  const count = selectedIds.value.length
  try {
    await ElMessageBox.confirm(
      `确定批量删除选中的 ${count} 个职位 JD 吗？此操作不可恢复。`,
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

  batchDeleting.value = true
  try {
    const results = await Promise.allSettled(
      selectedIds.value.map((id) => jobApi.remove(id)),
    )
    const successCount = results.filter((r) => r.status === 'fulfilled').length
    ElMessage.success(`已成功删除 ${successCount} 个职位`)
    clearSelection()
    if (rows.value.length === count && query.page > 1) {
      query.page -= 1
    }
    await load()
  } catch (e) {
    fail(e, '批量删除失败')
  } finally {
    batchDeleting.value = false
  }
}

function openDetail(row: JobVO): void {
  void router.push({ name: 'job-detail', params: { id: row.id } })
}

const empty = computed(() => !loading.value && rows.value.length === 0)

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">目标职位</h1>
        <p class="page__sub">把想投的 JD 粘进来，AI 会读出它真正看重什么</p>
      </div>

      <div class="page__actions">
        <el-radio-group v-model="viewMode" class="page__mode-switch">
          <el-radio-button value="kanban">投递看板 CRM</el-radio-button>
          <el-radio-button value="grid">卡片列表</el-radio-button>
        </el-radio-group>
        <el-input
          v-model="query.keyword"
          placeholder="搜职位或公司"
          clearable
          class="page__search"
          @keyup.enter="onSearch"
          @clear="onSearch"
        />
        <el-button
          v-if="viewMode === 'grid'"
          :type="batchMode ? 'primary' : 'default'"
          @click="toggleBatchMode"
        >
          {{ batchMode ? '退出批量' : '批量管理' }}
        </el-button>
        <el-button type="primary" :icon="Plus" @click="onCreate">添加职位</el-button>
      </div>
    </header>

    <!-- ---------- 求职投递看板 CRM ---------- -->
    <JobKanbanBoard v-if="viewMode === 'kanban'" ref="kanbanRef" :keyword="query.keyword" />

    <!-- ---------- 传统卡片列表与批量操作 ---------- -->
    <template v-else>
      <div v-if="batchMode" class="batch-bar">
        <span class="batch-bar__tip">
          已选择 <strong>{{ selectedIds.length }}</strong> / {{ rows.length }} 个职位
        </span>
        <div class="batch-bar__actions">
          <el-button size="small" @click="selectAll">全选本页</el-button>
          <el-button size="small" @click="clearSelection">清空已选</el-button>
          <el-button
            type="danger"
            size="small"
            :disabled="selectedIds.length === 0"
            :loading="batchDeleting"
            @click="onBatchDelete"
          >
            批量删除
          </el-button>
        </div>
      </div>

    <div v-loading="loading" class="grid">
      <article
        v-for="j in rows"
        :key="j.id"
        class="card"
        :class="{ 'card--selected': selectedIds.includes(j.id), 'card--selectable': batchMode }"
        @click="batchMode ? toggleSelect(j.id) : undefined"
      >
        <div v-if="batchMode" class="card__select">
          <el-checkbox
            :model-value="selectedIds.includes(j.id)"
            @click.stop
            @change="(val: unknown) => onCardCheck(j.id, val)"
          />
        </div>
        <div class="card__head">
          <el-icon class="card__icon"><Briefcase /></el-icon>
          <div class="card__main">
            <button type="button" class="card__name" @click="openDetail(j)">
              {{ j.title }}
            </button>
            <span class="card__meta">
              {{ [j.companyName, j.location].filter(Boolean).join(' · ') || '未填公司/地点' }}
            </span>
          </div>
          <span class="tag" :class="`tag--${STATUS_TONE[j.parseStatus]}`">
            {{ STATUS_TEXT[j.parseStatus] ?? j.parseStatus }}
          </span>
        </div>

        <p class="card__reqs">
          <span v-if="j.experienceRequired">{{ j.experienceRequired }}</span>
          <span v-if="j.educationRequired">{{ j.educationRequired }}</span>
          <span class="card__time">{{ formatDateTime(j.createdAt) }}</span>
        </p>

        <!-- 解析失败要把原因摆出来，别只留一个红标签 -->
        <p v-if="j.parseStatus === 'FAILED'" class="card__err">解析失败，点「重试解析」再试一次</p>

        <div class="card__foot">
          <el-button
            size="small"
            :icon="MagicStick"
            :loading="parsing === j.id"
            :disabled="parsing !== null"
            @click="onParse(j)"
          >
            {{ parsing === j.id ? '解析中' : j.parseStatus === 'SUCCESS' ? '重新解析' : '解析' }}
          </el-button>
          <el-button size="small" :icon="Edit" :disabled="parsing !== null" @click="onEdit(j)">
            编辑
          </el-button>
          <el-button
            size="small"
            text
            type="danger"
            :icon="Delete"
            :disabled="parsing !== null"
            @click="onRemove(j)"
          >
            删除
          </el-button>
        </div>
      </article>
    </div>

    <el-empty v-if="empty" description="还没有职位，点右上角添加一个">
      <el-button type="primary" :icon="Plus" @click="onCreate">添加职位</el-button>
    </el-empty>

    <el-pagination
      v-if="total > query.pageSize"
      v-model:current-page="query.page"
      v-model:page-size="query.pageSize"
      :total="total"
      :page-sizes="[12, 24, 48]"
      layout="total, sizes, prev, pager, next"
      class="page__pager"
      @change="() => load()"
    />
    </template>

    <JobFormDialog v-model="formVisible" :job="formJob" @saved="onJobSaved" />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-5);
  max-width: 1360px;
  margin: 0 auto;
}

.page__head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-4);
  align-items: flex-start;
  justify-content: space-between;
}

.page__title {
  margin: 0 0 var(--mf-space-1);
  font-size: var(--mf-font-xl);
  font-weight: var(--mf-weight-medium);
  letter-spacing: -0.02em;
}

.page__sub {
  margin: 0;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
}

.page__actions {
  display: flex;
  gap: var(--mf-space-3);
  align-items: center;
}

.page__search {
  width: 200px;
}

.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--mf-space-2) var(--mf-space-4);
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

/* ---------- 卡片 ---------- */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--mf-space-4);
  min-height: 120px;
}

.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3);
  padding: var(--mf-space-5);
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
  transition: all 0.2s ease;
}

.card--selectable {
  cursor: pointer;
  user-select: none;
}

.card--selected {
  background-color: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
}

.card__select {
  position: absolute;
  top: var(--mf-space-3);
  right: var(--mf-space-3);
  z-index: 2;
}

.card__head {
  display: flex;
  gap: var(--mf-space-3);
  align-items: flex-start;
}

.card__icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  color: var(--mf-primary-text);
  background-color: var(--mf-primary-subtle);
  border-radius: var(--mf-radius-md);
}

.card__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.card__name {
  padding: 0;
  font-size: var(--mf-font-md);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-primary);
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;
}

.card__name:hover {
  color: var(--mf-primary-text);
}

.card__name:focus-visible {
  outline: 2px solid var(--mf-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

.card__meta {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.card__reqs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-3);
  align-items: center;
  margin: 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.card__time {
  margin-left: auto;
  color: var(--mf-text-tertiary);
}

.card__err {
  margin: 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-danger-text);
}

.card__foot {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-2);
  margin-top: auto;
}

/* ---------- 状态标签 ---------- */
.tag {
  flex: none;
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

.page__pager {
  justify-content: flex-end;
}
</style>
