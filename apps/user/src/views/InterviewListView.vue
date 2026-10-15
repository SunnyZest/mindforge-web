<script setup lang="ts">
import { Plus, Delete, Microphone, Right, Notebook } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  BizError,
  formatDateTime,
  type InterviewMistakeStatsVO,
  type InterviewStatus,
  type InterviewVO,
} from '@mindforge/shared'

import { interviewApi } from '@/api/interview'
import InterviewCreateDialog from '@/components/InterviewCreateDialog.vue'
import InterviewMistakeBook from '@/components/InterviewMistakeBook.vue'

const router = useRouter()
const route = useRoute()

/**
 * 当前视图：面试列表 / 错题本。
 *
 * 初始值跟着 `?view=mistakes` 走 —— 工作台的「待攻克错题」卡片会带这个参数跳过来，
 * 落地直接就是错题本，不用用户再点一次「错题本与薄弱点重练」。
 * 非法值回落列表（和 JobListView 的 view 一个处理方式）。
 */
const activeView = ref<'interviews' | 'mistakes'>(
  route.query.view === 'mistakes' ? 'mistakes' : 'interviews',
)
const weakCountBadge = ref(0)

const loading = ref(false)
const rows = ref<InterviewVO[]>([])
const total = ref(0)
const query = reactive<{ page: number; pageSize: number; status?: InterviewStatus }>({
  page: 1,
  pageSize: 12,
})

const createVisible = ref(false)

const STATUS_TEXT: Record<InterviewStatus, string> = {
  CREATED: '未开始',
  IN_PROGRESS: '进行中',
  FINISHED: '已完成',
}

const STATUS_TONE: Record<InterviewStatus, 'neutral' | 'warning' | 'success'> = {
  CREATED: 'neutral',
  IN_PROGRESS: 'warning',
  FINISHED: 'success',
}

const TYPE_TEXT: Record<string, string> = {
  TECHNICAL: '技术面',
  BEHAVIORAL: '行为面',
  MIXED: '综合面',
}

const DIFF_TEXT: Record<string, string> = {
  EASY: '简单',
  MEDIUM: '中等',
  HARD: '困难',
}

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await interviewApi.page({
      page: query.page,
      pageSize: query.pageSize,
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

function onFilter(status?: InterviewStatus): void {
  query.status = status
  query.page = 1
  void load()
}

function openRoom(row: InterviewVO): void {
  void router.push({ name: 'interview-room', params: { id: row.id } })
}

/** 创建完直接进面试间 —— 用户下一步就是「生成题目」，没必要在列表上多停一步 */
function onCreated(id: string): void {
  void router.push({ name: 'interview-room', params: { id } })
}

async function onRemove(row: InterviewVO): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除面试「${row.title}」？题目和报告会一起删掉。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return // 用户取消
  }

  try {
    await interviewApi.remove(row.id)
    ElMessage.success('已删除')
    if (rows.value.length === 1 && query.page > 1) query.page -= 1
    await load()
  } catch (e) {
    fail(e, '删除失败')
  }
}

/** 进行中的排前面 —— 没做完的才是用户要接着做的 */
const empty = computed(() => !loading.value && rows.value.length === 0)

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
  selectedIds.value = rows.value.map((it) => it.id)
}

function clearSelection(): void {
  selectedIds.value = []
}

async function onBatchDelete(): Promise<void> {
  if (!selectedIds.value.length) return
  const count = selectedIds.value.length
  try {
    await ElMessageBox.confirm(
      `确定批量删除选中的 ${count} 场面试记录？题目和报告会一并清理，此操作不可恢复。`,
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
      selectedIds.value.map((id) => interviewApi.remove(id)),
    )
    const successCount = results.filter((r) => r.status === 'fulfilled').length
    ElMessage.success(`已成功删除 ${successCount} 场面试记录`)
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

const FILTERS: { label: string; value?: InterviewStatus }[] = [
  { label: '全部', value: undefined },
  { label: '未开始', value: 'CREATED' },
  { label: '进行中', value: 'IN_PROGRESS' },
  { label: '已完成', value: 'FINISHED' },
]

async function loadMistakeBadge(): Promise<void> {
  try {
    const s = await interviewApi.mistakeStats()
    weakCountBadge.value = s.weakCount
  } catch {
    // 忽略统计角标错误
  }
}

function onMistakeStatsLoaded(s: InterviewMistakeStatsVO): void {
  weakCountBadge.value = s.weakCount
}

onMounted(() => {
  void load()
  void loadMistakeBadge()
})

/** 切视图时写进 query —— 刷新后还在错题本，链接也能分享 */
watch(activeView, (view) => {
  void router.replace({ query: { ...route.query, view } })
})
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">模拟面试与错题特训</h1>
        <p class="page__sub">
          按你的简历和目标岗位出题，答完逐题点评 + 自动归集薄弱错题反复重练刷分
        </p>
      </div>

      <div class="page__actions">
        <el-button
          :type="activeView === 'mistakes' ? 'warning' : 'default'"
          :icon="Notebook"
          @click="activeView = activeView === 'mistakes' ? 'interviews' : 'mistakes'"
        >
          {{ activeView === 'mistakes' ? '返回面试列表' : '错题本与薄弱点重练' }}
          <span v-if="weakCountBadge > 0 && activeView !== 'mistakes'" class="weak-pill">
            {{ weakCountBadge }}
          </span>
        </el-button>
        <el-button
          v-if="activeView === 'interviews'"
          :type="batchMode ? 'primary' : 'default'"
          @click="toggleBatchMode"
        >
          {{ batchMode ? '退出批量' : '批量管理' }}
        </el-button>
        <el-button type="primary" :icon="Plus" @click="createVisible = true">新建面试</el-button>
      </div>
    </header>

    <InterviewMistakeBook
      v-if="activeView === 'mistakes'"
      @stats-loaded="onMistakeStatsLoaded"
    />

    <template v-else>
      <div class="tabs">
        <button
          v-for="f in FILTERS"
          :key="f.label"
          type="button"
          class="tabs__item"
          :class="{ 'tabs__item--on': query.status === f.value }"
          @click="onFilter(f.value)"
        >
          {{ f.label }}
        </button>
      </div>

      <div v-if="batchMode" class="batch-bar">
        <span class="batch-bar__tip">
          已选择 <strong>{{ selectedIds.length }}</strong> / {{ rows.length }} 场面试
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
          v-for="it in rows"
          :key="it.id"
          class="card"
          :class="{ 'card--selected': selectedIds.includes(it.id), 'card--selectable': batchMode }"
          @click="batchMode ? toggleSelect(it.id) : undefined"
        >
          <div v-if="batchMode" class="card__select">
            <el-checkbox
              :model-value="selectedIds.includes(it.id)"
              @click.stop
              @change="(val: unknown) => onCardCheck(it.id, val)"
            />
          </div>
          <div class="card__head">
            <el-icon class="card__icon"><Microphone /></el-icon>
            <div class="card__main">
              <button type="button" class="card__name" @click="openRoom(it)">{{ it.title }}</button>
              <span class="card__meta">
                {{ TYPE_TEXT[it.interviewType] ?? it.interviewType }} ·
                {{ DIFF_TEXT[it.difficulty] ?? it.difficulty }}
                <template v-if="it.questionCount"> · {{ it.questionCount }} 道题</template>
              </span>
            </div>
            <span class="tag" :class="`tag--${STATUS_TONE[it.status]}`">
              {{ STATUS_TEXT[it.status] ?? it.status }}
            </span>
          </div>

          <!-- 进度条：进行中的面试最需要知道「还剩几题」 -->
          <div v-if="it.status === 'IN_PROGRESS' && it.questionCount" class="progress">
            <div class="progress__bar">
              <div
                class="progress__fill"
                :style="{ width: ((it.answeredCount ?? 0) / it.questionCount) * 100 + '%' }"
              />
            </div>
            <span class="progress__text">{{ it.answeredCount ?? 0 }} / {{ it.questionCount }}</span>
          </div>

          <p class="card__foot-line">
            <span v-if="it.averageScore !== null" class="card__score">
              平均 {{ it.averageScore }} 分
            </span>
            <span class="card__time">{{ formatDateTime(it.createdAt) }}</span>
          </p>

          <div class="card__foot">
            <el-button size="small" type="primary" :icon="Right" @click="openRoom(it)">
              {{
                it.status === 'FINISHED'
                  ? '看报告'
                  : it.status === 'IN_PROGRESS'
                    ? '继续作答'
                    : '开始'
              }}
            </el-button>
            <el-button size="small" text type="danger" :icon="Delete" @click="onRemove(it)">
              删除
            </el-button>
          </div>
        </article>
      </div>

      <el-empty v-if="empty" description="还没有面试，点右上角新建一场">
        <el-button type="primary" :icon="Plus" @click="createVisible = true">新建面试</el-button>
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

    <InterviewCreateDialog v-model="createVisible" @created="onCreated" />
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

/* ---------- 状态筛选 ---------- */
.tabs {
  display: flex;
  gap: var(--mf-space-2);
}

.tabs__item {
  padding: var(--mf-space-1) var(--mf-space-4);
  font-size: var(--mf-font-sm);
  color: var(--mf-text-secondary);
  cursor: pointer;
  background-color: var(--mf-glass-tint);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-pill);
  transition:
    background-color var(--mf-duration-fast) var(--mf-ease-out),
    color var(--mf-duration-fast) var(--mf-ease-out);
}

.tabs__item:hover {
  color: var(--mf-text-primary);
  background-color: var(--mf-glass-tint-strong);
}

.tabs__item--on {
  color: var(--mf-primary-text);
  background-color: var(--mf-primary-subtle);
  border-color: var(--mf-primary);
}

.tabs__item:focus-visible {
  outline: 2px solid var(--mf-primary);
  outline-offset: 2px;
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

/* ---------- 进度 ---------- */
.progress {
  display: flex;
  gap: var(--mf-space-3);
  align-items: center;
}

.progress__bar {
  flex: 1;
  height: 6px;
  overflow: hidden;
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-pill);
}

.progress__fill {
  height: 100%;
  background-color: var(--mf-primary);
  border-radius: var(--mf-radius-pill);
  transition: width var(--mf-duration-normal) var(--mf-ease-out);
}

.progress__text {
  flex: none;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.card__foot-line {
  display: flex;
  gap: var(--mf-space-3);
  align-items: center;
  justify-content: space-between;
  margin: 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.card__score {
  font-weight: var(--mf-weight-medium);
  color: var(--mf-primary-text);
}

.card__time {
  margin-left: auto;
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

.page__pager {
  justify-content: flex-end;
}

.weak-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  margin-left: 6px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--mf-warning-text);
  background-color: var(--mf-warning-subtle);
  border-radius: 999px;
}
</style>
