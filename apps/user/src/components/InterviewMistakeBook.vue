<script setup lang="ts">
import {
  Check,
  EditPen,
  Refresh,
  Search,
  View,
  Hide,
  WarningFilled,
  TrophyBase,
} from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import {
  BizError,
  formatDateTime,
  type InterviewDifficulty,
  type InterviewMistakeStatsVO,
  type InterviewMistakeVO,
  type MistakeMasteryStatus,
  type QuestionType,
} from '@mindforge/shared'

import { interviewApi } from '@/api/interview'

const emit = defineEmits<{
  statsLoaded: [stats: InterviewMistakeStatsVO]
}>()

const router = useRouter()

const loading = ref(false)
const stats = ref<InterviewMistakeStatsVO>({
  totalAnswered: 0,
  weakCount: 0,
  masteredCount: 0,
  averageScore: null,
})
const rows = ref<InterviewMistakeVO[]>([])
const total = ref(0)

const query = reactive<{
  page: number
  pageSize: number
  masteryStatus: MistakeMasteryStatus
  questionType?: QuestionType
  difficulty?: InterviewDifficulty
  keyword: string
}>({
  page: 1,
  pageSize: 10,
  masteryStatus: 'WEAK',
  questionType: undefined,
  difficulty: undefined,
  keyword: '',
})

/** 控制每道题「标准参考答案要点」是否展开（默认折叠方便用户先自测思考） */
const revealedIds = ref<Set<string>>(new Set())

/** 单题重练弹窗状态 */
const practiceVisible = ref(false)
const practicingItem = ref<InterviewMistakeVO | null>(null)
const practiceAnswer = ref('')
const practiceSubmitting = ref(false)

const QUESTION_TYPE_TEXT: Record<string, string> = {
  TECHNICAL: '技术深挖',
  BEHAVIORAL: '行为面试',
  SITUATIONAL: '情景实战',
}

const DIFF_TEXT: Record<string, string> = {
  EASY: '简单',
  MEDIUM: '中等',
  HARD: '困难',
}

const MASTERY_TABS: { label: string; value: MistakeMasteryStatus }[] = [
  { label: '待攻克薄弱项 (<75分)', value: 'WEAK' },
  { label: '已攻克掌握 (≥75分)', value: 'MASTERED' },
  { label: '全部已答题目', value: 'ALL' },
]

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

async function loadStats(): Promise<void> {
  try {
    const res = await interviewApi.mistakeStats()
    stats.value = res
    emit('statsLoaded', res)
  } catch {
    // 静默忽略统计加载失败
  }
}

async function loadList(): Promise<void> {
  loading.value = true
  try {
    const res = await interviewApi.pageMistakes({
      page: query.page,
      pageSize: query.pageSize,
      masteryStatus: query.masteryStatus,
      questionType: query.questionType,
      difficulty: query.difficulty,
      keyword: query.keyword.trim() || undefined,
    })
    rows.value = res.records
    total.value = res.total
  } catch (e) {
    fail(e, '加载错题本失败')
  } finally {
    loading.value = false
  }
}

async function refreshAll(): Promise<void> {
  await Promise.all([loadStats(), loadList()])
}

function onSwitchMastery(status: MistakeMasteryStatus): void {
  query.masteryStatus = status
  query.page = 1
  void loadList()
}

function onSearch(): void {
  query.page = 1
  void loadList()
}

function toggleReveal(questionId: string): void {
  const next = new Set(revealedIds.value)
  if (next.has(questionId)) {
    next.delete(questionId)
  } else {
    next.add(questionId)
  }
  revealedIds.value = next
}

function openPractice(item: InterviewMistakeVO): void {
  practicingItem.value = item
  practiceAnswer.value = item.userAnswer ?? ''
  practiceVisible.value = true
}

async function submitPractice(): Promise<void> {
  const item = practicingItem.value
  if (!item) return
  const trimmed = practiceAnswer.value.trim()
  if (!trimmed) {
    ElMessage.warning('请先填写重练回答内容')
    return
  }

  practiceSubmitting.value = true
  try {
    const updated = await interviewApi.practiceQuestion(item.questionId, {
      answer: trimmed,
    })
    const prevScore = item.score ?? 0
    const newScore = updated.score ?? 0
    if (updated.mastered && !item.mastered) {
      ElMessage.success(`恭喜攻克该题！得分从 ${prevScore} 分提升至 ${newScore} 分`)
    } else {
      ElMessage.success(`重练评分完成：最新得分 ${newScore} 分`)
    }
    practiceVisible.value = false
    // 自动展开该题的参考要点便于对照
    const nextRevealed = new Set(revealedIds.value)
    nextRevealed.add(item.questionId)
    revealedIds.value = nextRevealed
    await refreshAll()
  } catch (e) {
    fail(e, '重练评分失败，请稍后重试')
  } finally {
    practiceSubmitting.value = false
  }
}

function goInterview(interviewId: string): void {
  void router.push({ name: 'interview-room', params: { id: interviewId } })
}

const emptyText = computed(() => {
  if (query.masteryStatus === 'WEAK') {
    return stats.value.totalAnswered > 0
      ? '太棒了！当前筛选条件下没有低于 75 分的薄弱题目'
      : '暂无错题记录（完成并结束模拟面试后，低分与漏答题目会自动归集到这里）'
  }
  if (query.masteryStatus === 'MASTERED') {
    return '暂无已掌握（≥75分）的题目，快去重练攻克薄弱项吧'
  }
  return '暂无已作答的面试题目'
})

onMounted(refreshAll)
</script>

<template>
  <div class="mb">
    <!-- 顶部四维统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-card__label">累计已答题目</span>
        <strong class="stat-card__value">{{ stats.totalAnswered }}</strong>
        <span class="stat-card__sub">来自已完成的模拟面试</span>
      </div>

      <div class="stat-card stat-card--warn">
        <span class="stat-card__label">待攻克薄弱项 (&lt;75分)</span>
        <strong class="stat-card__value">{{ stats.weakCount }}</strong>
        <span class="stat-card__sub">建议针对漏答要点重新作答</span>
      </div>

      <div class="stat-card stat-card--ok">
        <span class="stat-card__label">已攻克掌握 (≥75分)</span>
        <strong class="stat-card__value">{{ stats.masteredCount }}</strong>
        <span class="stat-card__sub">重练达标后自动移入掌握库</span>
      </div>

      <div class="stat-card">
        <span class="stat-card__label">单题平均得分</span>
        <strong class="stat-card__value">
          {{ stats.averageScore !== null ? `${stats.averageScore} 分` : '—' }}
        </strong>
        <span class="stat-card__sub">随单题重练刷分实时更新</span>
      </div>
    </div>

    <!-- 筛选工具栏 -->
    <div class="toolbar">
      <div class="tabs">
        <button
          v-for="t in MASTERY_TABS"
          :key="t.value"
          type="button"
          class="tabs__item"
          :class="{ 'tabs__item--on': query.masteryStatus === t.value }"
          @click="onSwitchMastery(t.value)"
        >
          {{ t.label }}
        </button>
      </div>

      <div class="filters">
        <el-select
          v-model="query.questionType"
          placeholder="全部题型"
          clearable
          size="default"
          class="filters__select"
          @change="onSearch"
        >
          <el-option label="技术深挖" value="TECHNICAL" />
          <el-option label="行为面试" value="BEHAVIORAL" />
          <el-option label="情景实战" value="SITUATIONAL" />
        </el-select>

        <el-select
          v-model="query.difficulty"
          placeholder="全部难度"
          clearable
          size="default"
          class="filters__select"
          @change="onSearch"
        >
          <el-option label="简单" value="EASY" />
          <el-option label="中等" value="MEDIUM" />
          <el-option label="困难" value="HARD" />
        </el-select>

        <el-input
          v-model="query.keyword"
          placeholder="搜索题目关键词..."
          clearable
          class="filters__input"
          @keyup.enter="onSearch"
          @clear="onSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>

        <el-button :icon="Refresh" @click="refreshAll">刷新</el-button>
      </div>
    </div>

    <!-- 错题闪卡列表 -->
    <div v-loading="loading" class="list">
      <article
        v-for="item in rows"
        :key="item.questionId"
        class="mcard"
        :class="{ 'mcard--mastered': item.mastered }"
      >
        <header class="mcard__head">
          <div class="mcard__badges">
            <span class="badge" :class="item.mastered ? 'badge--ok' : 'badge--warn'">
              <el-icon v-if="item.mastered"><TrophyBase /></el-icon>
              <el-icon v-else><WarningFilled /></el-icon>
              {{ item.mastered ? '已掌握' : '待攻克' }} · {{ item.score ?? 0 }} 分
            </span>
            <span class="badge badge--neutral">
              {{ QUESTION_TYPE_TEXT[item.questionType ?? ''] ?? item.questionType ?? '综合' }}
            </span>
            <span class="badge badge--neutral">
              难度：{{ DIFF_TEXT[item.difficulty ?? ''] ?? item.difficulty ?? '中等' }}
            </span>
            <button
              type="button"
              class="mcard__source"
              @click="goInterview(item.interviewId)"
            >
              来自：{{ item.interviewTitle }}（第 {{ item.questionNo }} 题）
            </button>
          </div>

          <span class="mcard__time">{{ formatDateTime(item.answeredAt) }}</span>
        </header>

        <!-- 题目内容 -->
        <h3 class="mcard__question">Q{{ item.questionNo }}. {{ item.question }}</h3>

        <!-- 候选人回答与 AI 诊断 -->
        <div class="mcard__body">
          <div class="ans-box">
            <span class="ans-box__label">我的最近作答</span>
            <p class="ans-box__text">{{ item.userAnswer || '（当时跳过了本题，未作答）' }}</p>
          </div>

          <div v-if="item.aiAnalysis?.comment" class="diag-box">
            <span class="diag-box__label">AI 面试官点评</span>
            <p class="diag-box__text">{{ item.aiAnalysis.comment }}</p>
          </div>

          <!-- 漏答的核心要点（最关键的提分点） -->
          <div v-if="item.aiAnalysis?.missingPoints?.length" class="missing-box">
            <span class="missing-box__label">⚠️ 回答遗漏的核心得分点（重练时请重点补充）：</span>
            <ul class="missing-box__list">
              <li v-for="(mp, idx) in item.aiAnalysis.missingPoints" :key="idx">{{ mp }}</li>
            </ul>
          </div>

          <!-- 面试官追问预演 -->
          <div v-if="item.aiAnalysis?.followUp" class="followup-box">
            <span class="followup-box__label">💡 面试官深度追问预演：</span>
            <p class="followup-box__text">{{ item.aiAnalysis.followUp }}</p>
          </div>

          <!-- 折叠/展开标准参考答案要点 -->
          <div v-if="item.expectedPoints?.length && revealedIds.has(item.questionId)" class="expected-box">
            <span class="expected-box__label">🎯 标准参考答案核心要点：</span>
            <ul class="expected-box__list">
              <li v-for="(ep, idx) in item.expectedPoints" :key="idx">{{ ep }}</li>
            </ul>
          </div>
        </div>

        <footer class="mcard__foot">
          <el-button
            v-if="item.expectedPoints?.length"
            size="small"
            :icon="revealedIds.has(item.questionId) ? Hide : View"
            @click="toggleReveal(item.questionId)"
          >
            {{ revealedIds.has(item.questionId) ? '收起参考答案要点' : '查看标准参考答案要点' }}
          </el-button>

          <el-button
            size="small"
            type="primary"
            :icon="EditPen"
            @click="openPractice(item)"
          >
            {{ item.mastered ? '再次巩固刷分' : '针对此题重练刷分' }}
          </el-button>
        </footer>
      </article>
    </div>

    <el-empty v-if="!loading && rows.length === 0" :description="emptyText" />

    <el-pagination
      v-if="total > query.pageSize"
      v-model:current-page="query.page"
      v-model:page-size="query.pageSize"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next"
      class="mb__pager"
      @change="() => loadList()"
    />

    <!-- 单题重练弹窗 -->
    <el-dialog
      v-model="practiceVisible"
      title="错题针对性重练与 AI 重新评分"
      width="680px"
      :close-on-click-modal="!practiceSubmitting"
      :close-on-press-escape="!practiceSubmitting"
      :show-close="!practiceSubmitting"
    >
      <div v-if="practicingItem" class="practice-modal">
        <div class="practice-modal__q">
          <span class="practice-modal__tag">
            上次得分：{{ practicingItem.score ?? 0 }} 分（满 75 分即标记为已掌握）
          </span>
          <h4>{{ practicingItem.question }}</h4>
        </div>

        <div v-if="practicingItem.aiAnalysis?.missingPoints?.length" class="practice-modal__hint">
          <strong>💡 上次漏答要点提示：</strong>
          <ul>
            <li v-for="(mp, idx) in practicingItem.aiAnalysis.missingPoints" :key="idx">
              {{ mp }}
            </li>
          </ul>
        </div>

        <el-input
          v-model="practiceAnswer"
          type="textarea"
          :rows="7"
          maxlength="6000"
          show-word-limit
          placeholder="请结合漏答要点，用结构化（如总-分-总或 STAR 法则）重新组织你的回答..."
          :disabled="practiceSubmitting"
        />
      </div>

      <template #footer>
        <el-button :disabled="practiceSubmitting" @click="practiceVisible = false">取消</el-button>
        <el-button
          type="primary"
          :icon="Check"
          :loading="practiceSubmitting"
          @click="submitPractice"
        >
          {{ practiceSubmitting ? 'AI 正在评分中...' : '提交并重新评分' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.mb {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-5);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--mf-space-4);
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--mf-space-4);
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
}

.stat-card--warn {
  border-left: 3px solid var(--mf-warning);
}

.stat-card--ok {
  border-left: 3px solid var(--mf-success);
}

.stat-card__label {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.stat-card__value {
  font-size: var(--mf-font-xl);
  font-weight: var(--mf-weight-semibold);
  color: var(--mf-text-primary);
}

.stat-card__sub {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-3);
  align-items: center;
  justify-content: space-between;
}

.tabs {
  display: flex;
  gap: var(--mf-space-1);
  padding: 3px;
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-md);
}

.tabs__item {
  padding: 6px var(--mf-space-3);
  font-family: inherit;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--mf-radius-sm);
  transition: all 0.15s ease;
}

.tabs__item--on {
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-primary);
  background-color: var(--mf-bg-elevated);
  box-shadow: var(--mf-shadow-xs);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-2);
  align-items: center;
}

.filters__select {
  width: 128px;
}

.filters__input {
  width: 210px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-4);
}

.mcard {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3);
  padding: var(--mf-space-5);
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-left: 3px solid var(--mf-warning);
  border-radius: var(--mf-radius-lg);
}

.mcard--mastered {
  border-left-color: var(--mf-success);
}

.mcard__head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-2);
  align-items: center;
  justify-content: space-between;
}

.mcard__badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-2);
  align-items: center;
}

.badge {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 2px var(--mf-space-3);
  font-size: var(--mf-font-xs);
  font-weight: var(--mf-weight-medium);
  border-radius: var(--mf-radius-pill);
}

.badge--warn {
  color: var(--mf-warning-text);
  background-color: var(--mf-warning-subtle);
}

.badge--ok {
  color: var(--mf-success-text);
  background-color: var(--mf-success-subtle);
}

.badge--neutral {
  color: var(--mf-text-secondary);
  background-color: var(--mf-bg-subtle);
}

.mcard__source {
  padding: 0;
  font-family: inherit;
  font-size: var(--mf-font-xs);
  color: var(--mf-primary);
  cursor: pointer;
  background: transparent;
  border: 0;
}

.mcard__source:hover {
  text-decoration: underline;
}

.mcard__time {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.mcard__question {
  margin: 0;
  font-size: var(--mf-font-md);
  font-weight: var(--mf-weight-medium);
  line-height: 1.6;
  color: var(--mf-text-primary);
}

.mcard__body {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3);
}

.ans-box,
.diag-box,
.missing-box,
.followup-box,
.expected-box {
  padding: var(--mf-space-3) var(--mf-space-4);
  border-radius: var(--mf-radius-md);
}

.ans-box {
  background-color: var(--mf-bg-subtle);
}

.diag-box {
  background-color: var(--mf-bg-surface);
  border: 1px solid var(--mf-glass-border-soft);
}

.missing-box {
  background-color: var(--mf-warning-subtle);
  border: 1px dashed var(--mf-warning);
}

.followup-box {
  background-color: var(--mf-bg-subtle);
  border-left: 3px solid var(--mf-primary);
}

.expected-box {
  background-color: var(--mf-success-subtle);
  border: 1px solid var(--mf-success);
}

.ans-box__label,
.diag-box__label,
.missing-box__label,
.followup-box__label,
.expected-box__label {
  display: block;
  margin-bottom: 4px;
  font-size: var(--mf-font-xs);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-secondary);
}

.ans-box__text,
.diag-box__text,
.followup-box__text {
  margin: 0;
  font-size: var(--mf-font-sm);
  line-height: 1.65;
  color: var(--mf-text-primary);
  white-space: pre-wrap;
}

.missing-box__list,
.expected-box__list {
  margin: 0;
  padding-left: 1.25em;
  font-size: var(--mf-font-sm);
  line-height: 1.7;
  color: var(--mf-text-primary);
}

.mcard__foot {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-2);
  align-items: center;
  justify-content: flex-end;
  padding-top: var(--mf-space-2);
  border-top: 1px solid var(--mf-glass-border-soft);
}

.mb__pager {
  justify-content: flex-end;
}

.practice-modal {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-4);
}

.practice-modal__q h4 {
  margin: var(--mf-space-2) 0 0;
  font-size: var(--mf-font-md);
  line-height: 1.6;
}

.practice-modal__tag {
  display: inline-block;
  padding: 2px var(--mf-space-2);
  font-size: var(--mf-font-xs);
  color: var(--mf-warning-text);
  background-color: var(--mf-warning-subtle);
  border-radius: var(--mf-radius-pill);
}

.practice-modal__hint {
  padding: var(--mf-space-3);
  font-size: var(--mf-font-xs);
  line-height: 1.6;
  background-color: var(--mf-warning-subtle);
  border-radius: var(--mf-radius-md);
}

.practice-modal__hint ul {
  margin: 4px 0 0;
  padding-left: 1.2em;
}
</style>
