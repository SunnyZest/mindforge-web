<script setup lang="ts">
import { Plus, Delete, Microphone, Right } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { BizError, formatDateTime, type InterviewStatus, type InterviewVO } from '@mindforge/shared'

import { interviewApi } from '@/api/interview'
import InterviewCreateDialog from '@/components/InterviewCreateDialog.vue'

const router = useRouter()

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

const FILTERS: { label: string; value?: InterviewStatus }[] = [
  { label: '全部', value: undefined },
  { label: '未开始', value: 'CREATED' },
  { label: '进行中', value: 'IN_PROGRESS' },
  { label: '已完成', value: 'FINISHED' },
]

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">模拟面试</h1>
        <p class="page__sub">按你的简历和目标岗位出题，答完逐题点评 + 一份总报告</p>
      </div>

      <el-button type="primary" :icon="Plus" @click="createVisible = true">新建面试</el-button>
    </header>

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

    <div v-loading="loading" class="grid">
      <article v-for="it in rows" :key="it.id" class="card">
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
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3);
  padding: var(--mf-space-5);
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
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
</style>
