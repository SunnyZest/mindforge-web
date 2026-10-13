<script setup lang="ts">
import {
  Briefcase,
  Calendar,
  ChatDotRound,
  Edit,
  Promotion,
  Right,
  Timer,
  Trophy,
} from '@element-plus/icons-vue'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import {
  BizError,
  type JobApplicationStage,
  type JobKanbanCardVO,
  type JobKanbanColumnVO,
  type JobKanbanStatsVO,
} from '@mindforge/shared'

import { jobApi } from '@/api/job'
import JobCrmDialog from '@/components/JobCrmDialog.vue'

const props = defineProps<{
  keyword?: string
}>()

const router = useRouter()

const loading = ref(false)
const columns = ref<JobKanbanColumnVO[]>([])
const stats = ref<JobKanbanStatsVO>({
  totalTracked: 0,
  appliedCount: 0,
  interviewingCount: 0,
  offerCount: 0,
  upcomingScheduleCount: 0,
})

const crmDialogVisible = ref(false)
const activeCard = ref<JobKanbanCardVO | null>(null)

const STAGE_OPTIONS: Array<{ label: string; value: JobApplicationStage }> = [
  { label: '心愿 / 待投递', value: 'WISHLIST' },
  { label: '已投递', value: 'APPLIED' },
  { label: '初筛 / 笔试', value: 'SCREENING' },
  { label: '技术一面', value: 'INTERVIEW_1' },
  { label: '技术二面 / 终面', value: 'INTERVIEW_2' },
  { label: 'HR 面 / 谈薪', value: 'HR' },
  { label: '已获 Offer 🎉', value: 'OFFER' },
  { label: '未通过 / 已归档', value: 'REJECTED' },
]

const STAGE_TONES: Record<JobApplicationStage, { bg: string; color: string; border: string }> = {
  WISHLIST: { bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b', border: '#cbd5e1' },
  APPLIED: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '#93c5fd' },
  SCREENING: { bg: 'rgba(234, 88, 12, 0.1)', color: '#ea580c', border: '#fdba74' },
  INTERVIEW_1: { bg: 'rgba(147, 51, 234, 0.1)', color: '#9333ea', border: '#d8b4fe' },
  INTERVIEW_2: { bg: 'rgba(126, 34, 206, 0.1)', color: '#7e22ce', border: '#c084fc' },
  HR: { bg: 'rgba(219, 39, 119, 0.1)', color: '#db2777', border: '#f472b6' },
  OFFER: { bg: 'rgba(22, 163, 74, 0.12)', color: '#16a34a', border: '#86efac' },
  REJECTED: { bg: 'rgba(156, 163, 175, 0.12)', color: '#9ca3af', border: '#d1d5db' },
}

async function loadData(): Promise<void> {
  loading.value = true
  try {
    const [colsRes, statsRes] = await Promise.all([
      jobApi.kanban(props.keyword?.trim() || undefined),
      jobApi.kanbanStats(),
    ])
    columns.value = colsRes
    stats.value = statsRes
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '加载看板数据失败')
  } finally {
    loading.value = false
  }
}

async function onQuickStageChange(card: JobKanbanCardVO, nextStage: JobApplicationStage): Promise<void> {
  if (card.applicationStage === nextStage) return
  const oldStage = card.applicationStage
  card.applicationStage = nextStage

  try {
    await jobApi.updateStage(card.id, nextStage)
    ElMessage.success(`已移至「${STAGE_OPTIONS.find((s) => s.value === nextStage)?.label}」`)
    await loadData()
  } catch (e) {
    card.applicationStage = oldStage
    ElMessage.error(e instanceof BizError ? e.message : '更新状态失败')
  }
}

function openCrmDialog(card: JobKanbanCardVO): void {
  activeCard.value = card
  crmDialogVisible.value = true
}

function onCrmSaved(): void {
  void loadData()
}

function openDetail(card: JobKanbanCardVO): void {
  void router.push({ name: 'job-detail', params: { id: card.id } })
}

function startMockInterview(card: JobKanbanCardVO): void {
  void router.push({
    name: 'interviews',
    query: { targetJobId: card.id, targetJobTitle: card.title },
  })
}

function formatScheduleTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${m}-${day} ${h}:${min}`
}

function isUpcoming(iso: string | null): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  const now = Date.now()
  return t >= now && t <= now + 7 * 86400 * 1000
}

defineExpose({ refresh: loadData })

onMounted(loadData)
</script>

<template>
  <div v-loading="loading" class="kanban-wrapper">
    <!-- ---------- 顶部统计指标看板 ---------- -->
    <section class="stats-grid">
      <div class="stat-card">
        <div class="stat-card__icon stat-card__icon--blue">
          <el-icon><Briefcase /></el-icon>
        </div>
        <div class="stat-card__body">
          <span class="stat-card__label">总追踪职位</span>
          <strong class="stat-card__val">{{ stats.totalTracked }}</strong>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card__icon stat-card__icon--cyan">
          <el-icon><Promotion /></el-icon>
        </div>
        <div class="stat-card__body">
          <span class="stat-card__label">推进投递中</span>
          <strong class="stat-card__val">{{ stats.appliedCount }}</strong>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card__icon stat-card__icon--purple">
          <el-icon><ChatDotRound /></el-icon>
        </div>
        <div class="stat-card__body">
          <span class="stat-card__label">面试进行中</span>
          <strong class="stat-card__val">{{ stats.interviewingCount }}</strong>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card__icon stat-card__icon--green">
          <el-icon><Trophy /></el-icon>
        </div>
        <div class="stat-card__body">
          <span class="stat-card__label">已获 Offer 🎉</span>
          <strong class="stat-card__val stat-card__val--green">{{ stats.offerCount }}</strong>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card__icon stat-card__icon--orange">
          <el-icon><Calendar /></el-icon>
        </div>
        <div class="stat-card__body">
          <span class="stat-card__label">7天内待面日程</span>
          <strong class="stat-card__val stat-card__val--orange">
            {{ stats.upcomingScheduleCount }}
          </strong>
        </div>
      </div>
    </section>

    <!-- ---------- 8 列横向流动看板 ---------- -->
    <div class="board">
      <div v-for="col in columns" :key="col.stage" class="column">
        <!-- 列头 -->
        <header
          class="column__head"
          :style="{
            backgroundColor: STAGE_TONES[col.stage]?.bg,
            borderTopColor: STAGE_TONES[col.stage]?.color,
          }"
        >
          <div class="column__title-wrap">
            <span class="column__title" :style="{ color: STAGE_TONES[col.stage]?.color }">
              {{ col.title }}
            </span>
            <span class="column__badge">{{ col.count }}</span>
          </div>
        </header>

        <!-- 卡片列表 -->
        <div class="column__cards">
          <article v-for="card in col.cards" :key="card.id" class="k-card">
            <div class="k-card__top">
              <button type="button" class="k-card__title" @click="openDetail(card)">
                {{ card.title }}
              </button>
              <el-dropdown
                trigger="click"
                @command="(st: JobApplicationStage) => onQuickStageChange(card, st)"
              >
                <button
                  type="button"
                  class="k-card__stage-pill"
                  :style="{
                    color: STAGE_TONES[card.applicationStage]?.color,
                    borderColor: STAGE_TONES[card.applicationStage]?.border,
                  }"
                >
                  移至 <el-icon><Right /></el-icon>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="opt in STAGE_OPTIONS"
                      :key="opt.value"
                      :command="opt.value"
                      :disabled="card.applicationStage === opt.value"
                    >
                      {{ opt.label }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>

            <p class="k-card__company">
              {{ [card.companyName, card.location].filter(Boolean).join(' · ') || '未填公司' }}
            </p>

            <!-- 匹配度与面试进展徽章 -->
            <div class="k-card__pills">
              <span
                v-if="card.matchScore !== null"
                class="pill pill--match"
                :class="{
                  'pill--match-high': card.matchScore >= 80,
                  'pill--match-mid': card.matchScore >= 60 && card.matchScore < 80,
                }"
              >
                🎯 匹配度 {{ Math.round(card.matchScore) }}分
              </span>

              <span v-if="card.interviewCount > 0" class="pill pill--iv">
                🎤 模拟面 {{ card.interviewCount }} 场
                <template v-if="card.bestInterviewScore !== null">
                  · {{ Math.round(card.bestInterviewScore) }}分
                </template>
              </span>

              <span v-if="card.linkedResumeName" class="pill pill--resume" :title="card.linkedResumeName">
                📄 {{ card.linkedResumeName }}
              </span>

              <span v-if="card.salaryOffer" class="pill pill--salary">
                💰 {{ card.salaryOffer }}
              </span>
            </div>

            <!-- 下一场日程提醒 -->
            <div
              v-if="card.nextActionAt"
              class="k-card__schedule"
              :class="{ 'k-card__schedule--upcoming': isUpcoming(card.nextActionAt) }"
            >
              <el-icon><Timer /></el-icon>
              <span>{{ formatScheduleTime(card.nextActionAt) }} 待办提醒</span>
            </div>

            <!-- 备忘笔记预览 -->
            <p v-if="card.crmNotes" class="k-card__notes" :title="card.crmNotes">
              📌 {{ card.crmNotes }}
            </p>

            <!-- 卡片底部快捷动作 -->
            <footer class="k-card__footer">
              <el-button size="small" text type="primary" :icon="Edit" @click="openCrmDialog(card)">
                跟进记录
              </el-button>
              <el-button
                size="small"
                text
                type="primary"
                :icon="ChatDotRound"
                @click="startMockInterview(card)"
              >
                模拟面试
              </el-button>
            </footer>
          </article>

          <!-- 空列占位 -->
          <div v-if="col.cards.length === 0" class="column__empty">
            <span>暂无岗位</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 跟进编辑弹窗 -->
    <JobCrmDialog v-model="crmDialogVisible" :job="activeCard" @saved="onCrmSaved" />
  </div>
</template>

<style scoped>
.kanban-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-5);
  width: 100%;
}

/* ---------- 统计指标行 ---------- */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--mf-space-3);
}

.stat-card {
  display: flex;
  gap: var(--mf-space-3);
  align-items: center;
  padding: var(--mf-space-3) var(--mf-space-4);
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-md);
}

.stat-card__icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 40px;
  height: 40px;
  font-size: 20px;
  border-radius: var(--mf-radius-md);
}

.stat-card__icon--blue {
  color: #2563eb;
  background-color: rgba(37, 99, 235, 0.1);
}

.stat-card__icon--cyan {
  color: #0891b2;
  background-color: rgba(8, 145, 178, 0.1);
}

.stat-card__icon--purple {
  color: #7c3aed;
  background-color: rgba(124, 58, 237, 0.1);
}

.stat-card__icon--green {
  color: #16a34a;
  background-color: rgba(22, 163, 74, 0.12);
}

.stat-card__icon--orange {
  color: #ea580c;
  background-color: rgba(234, 88, 12, 0.1);
}

.stat-card__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-card__label {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.stat-card__val {
  font-size: var(--mf-font-xl);
  font-weight: 600;
  color: var(--mf-text-primary);
}

.stat-card__val--green {
  color: #16a34a;
}

.stat-card__val--orange {
  color: #ea580c;
}

/* ---------- 看板大画布 ---------- */
.board {
  display: flex;
  gap: var(--mf-space-3);
  padding-bottom: var(--mf-space-4);
  overflow-x: auto;
  align-items: flex-start;
}

.column {
  display: flex;
  flex: 0 0 280px;
  flex-direction: column;
  min-height: 460px;
  background-color: var(--mf-bg-subtle);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
  overflow: hidden;
}

.column__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--mf-space-3) var(--mf-space-4);
  border-top: 3px solid transparent;
  border-bottom: 1px solid var(--mf-glass-border-soft);
}

.column__title-wrap {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
}

.column__title {
  font-size: var(--mf-font-sm);
  font-weight: var(--mf-weight-medium);
}

.column__badge {
  padding: 1px 8px;
  font-size: var(--mf-font-xs);
  font-weight: 600;
  color: var(--mf-text-secondary);
  background-color: var(--mf-glass-card);
  border-radius: var(--mf-radius-pill);
}

.column__cards {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3);
  padding: var(--mf-space-3);
  flex: 1;
  max-height: 720px;
  overflow-y: auto;
}

.column__empty {
  display: grid;
  place-items: center;
  height: 120px;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
  border: 1px dashed var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-md);
}

/* ---------- 岗位卡片 ---------- */
.k-card {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-2);
  padding: var(--mf-space-3);
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-md);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.k-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
}

.k-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--mf-space-2);
}

.k-card__title {
  padding: 0;
  font-size: var(--mf-font-sm);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-primary);
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;
  line-height: 1.4;
}

.k-card__title:hover {
  color: var(--mf-primary-text);
  text-decoration: underline;
}

.k-card__stage-pill {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  padding: 1px 6px;
  font-size: 11px;
  cursor: pointer;
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-border-soft);
  border-radius: var(--mf-radius-pill);
  flex-shrink: 0;
}

.k-card__company {
  margin: 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.k-card__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.pill {
  padding: 1px 6px;
  font-size: 11px;
  border-radius: 4px;
}

.pill--match {
  color: #475569;
  background-color: #f1f5f9;
}

.pill--match-high {
  color: #15803d;
  background-color: #dcfce7;
}

.pill--match-mid {
  color: #c2410c;
  background-color: #ffedd5;
}

.pill--iv {
  color: #7e22ce;
  background-color: #f3e8ff;
}

.pill--resume {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #0369a1;
  background-color: #e0f2fe;
}

.pill--salary {
  color: #b45309;
  background-color: #fef3c7;
}

.k-card__schedule {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 2px 6px;
  font-size: 11px;
  color: var(--mf-text-tertiary);
  background-color: var(--mf-bg-subtle);
  border-radius: 4px;
}

.k-card__schedule--upcoming {
  font-weight: 500;
  color: #c2410c;
  background-color: #ffedd5;
}

.k-card__notes {
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.4;
  color: var(--mf-text-tertiary);
}

.k-card__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--mf-space-1);
  padding-top: var(--mf-space-2);
  border-top: 1px solid var(--mf-glass-border-soft);
}
</style>
