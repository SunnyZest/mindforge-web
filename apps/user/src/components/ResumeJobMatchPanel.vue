<script setup lang="ts">
import { Aim, Check } from '@element-plus/icons-vue'
import { computed, onMounted, ref, watch } from 'vue'

import {
  BizError,
  formatDateTime,
  type AnalysisCategory,
  type AnalysisVerdict,
  type ResumeJobAnalysisItemVO,
  type ResumeJobAnalysisVO,
  type ResumeVO,
} from '@mindforge/shared'

import { resumeApi } from '@/api/resume'
import { useSlowTask } from '@/composables/useSlowTask'

const props = defineProps<{
  jobId: string
  jobTitle: string
  jobParsed: boolean
}>()

// ---------- 简历列表与选择 ----------
const resumes = ref<ResumeVO[]>([])
const loadingResumes = ref(false)
const selectedResumeId = ref('')

// ---------- 匹配分析结果 ----------
const analysis = ref<ResumeJobAnalysisVO | null>(null)
const loadingAnalysis = ref(false)
const activeTab = ref<string>('ALL')

const { running, elapsed, run: runTask } = useSlowTask()

/** 五类结论元信息（按紧急度排序：需动手的排前，已匹配排后） */
const VERDICT_META: Record<
  AnalysisVerdict,
  { label: string; tagType: 'danger' | 'warning' | 'info' | 'success'; desc: string; order: number }
> = {
  REAL_GAP: {
    label: '真实缺口',
    tagType: 'danger',
    desc: '简历中完全没有，需要真实补齐能力或经历',
    order: 1,
  },
  EXPRESSION_GAP: {
    label: '表达缺口',
    tagType: 'warning',
    desc: '具备相关能力但描述不明确，改一句表述即可',
    order: 2,
  },
  INSUFFICIENT_EVIDENCE: {
    label: '证据不足',
    tagType: 'warning',
    desc: '提及了关键词但缺少量化指标与项目细节',
    order: 3,
  },
  UNCERTAIN: {
    label: '待确认',
    tagType: 'info',
    desc: '依据简历难以判定，需进一步沟通确认',
    order: 4,
  },
  MATCHED: {
    label: '已匹配',
    tagType: 'success',
    desc: '简历中有明确依据，高度符合岗位要求',
    order: 5,
  },
}

const CATEGORY_LABELS: Record<AnalysisCategory, string> = {
  SKILL: '技能',
  EXPERIENCE: '经历',
  EDUCATION: '学历',
  OTHER: '综合',
}

const selectedResume = computed(() =>
  resumes.value.find((r) => String(r.id) === String(selectedResumeId.value)),
)

/** 是否具备分析前置条件 */
const canAnalyze = computed(() => {
  if (!selectedResume.value) return false
  return props.jobParsed && selectedResume.value.parseStatus === 'SUCCESS'
})

/** 前置未满足原因提示 */
const analyzeDisabledReason = computed(() => {
  if (!selectedResumeId.value) return '请先选择一份简历'
  if (!props.jobParsed) return '请先解析本职位 JD'
  if (selectedResume.value?.parseStatus !== 'SUCCESS') return '所选简历尚未解析完成'
  return ''
})

/**
 * 按紧急程度排序并过滤列表
 * 真实缺口(1) → 表达缺口(2) → 证据不足(3) → 待确认(4) → 已匹配(5)
 */
const sortedItems = computed<ResumeJobAnalysisItemVO[]>(() => {
  const items = [...(analysis.value?.items ?? [])]
  items.sort((a, b) => VERDICT_META[a.verdict].order - VERDICT_META[b.verdict].order)
  if (activeTab.value === 'ALL') return items
  return items.filter((i) => i.verdict === activeTab.value)
})

/** 统计各类型数量，显示在 Tab 上 */
const countByVerdict = computed(() => {
  const map: Record<string, number> = { ALL: analysis.value?.items.length ?? 0 }
  for (const item of analysis.value?.items ?? []) {
    map[item.verdict] = (map[item.verdict] ?? 0) + 1
  }
  return map
})

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

async function loadResumes(): Promise<void> {
  loadingResumes.value = true
  try {
    const data = await resumeApi.page({ page: 1, pageSize: 50 })
    resumes.value = data.records
    // 默认选中第一份已解析成功的简历
    const parsedOne = data.records.find((r) => r.parseStatus === 'SUCCESS')
    if (parsedOne) {
      selectedResumeId.value = String(parsedOne.id)
    } else if (data.records.length > 0) {
      selectedResumeId.value = String(data.records[0].id)
    }
  } catch (e) {
    fail(e, '加载简历列表失败')
  } finally {
    loadingResumes.value = false
  }
}

async function loadAnalysis(): Promise<void> {
  if (!selectedResumeId.value || !props.jobId) {
    analysis.value = null
    return
  }

  loadingAnalysis.value = true
  try {
    analysis.value = await resumeApi.getMatch({
      resumeId: selectedResumeId.value,
      jobId: props.jobId,
    })
  } catch (e) {
    if (e instanceof BizError && e.code === 40413) {
      // 40413 表示尚未进行过匹配分析，属于正常空状态
      analysis.value = null
    } else {
      fail(e, '查询匹配历史失败')
    }
  } finally {
    loadingAnalysis.value = false
  }
}

/** 触发 AI 岗位匹配分析（慢接口，100~200 秒） */
async function onStartMatch(): Promise<void> {
  if (!canAnalyze.value) {
    ElMessage.warning(analyzeDisabledReason.value)
    return
  }

  try {
    const res = await runTask(() =>
      resumeApi.match({
        resumeId: selectedResumeId.value,
        jobId: props.jobId,
      }),
    )
    if (res) {
      analysis.value = res
      ElMessage.success('匹配分析完成')
    }
  } catch (e) {
    fail(e, '岗位匹配分析失败，请稍后重试')
  }
}

watch(selectedResumeId, () => {
  void loadAnalysis()
})

onMounted(async () => {
  await loadResumes()
  if (selectedResumeId.value) {
    await loadAnalysis()
  }
})
</script>

<template>
  <el-card class="match-panel">
    <!-- 面板头部与简历选择 -->
    <header class="match-head">
      <div class="match-head__info">
        <h3 class="match-head__title">
          <el-icon><Aim /></el-icon>
          简历与岗位匹配分析
        </h3>
        <p class="match-head__sub">
          基于大模型进行深度要求对齐，重点排查「真实缺口」与「表达缺口」，拒绝简单打分。
        </p>
      </div>

      <div class="match-head__ctrl">
        <div class="resume-picker">
          <span class="picker-label">分析简历:</span>
          <el-select
            v-model="selectedResumeId"
            placeholder="请选择简历"
            style="width: 200px"
            :disabled="running"
          >
            <el-option
              v-for="r in resumes"
              :key="r.id"
              :label="r.name"
              :value="String(r.id)"
            >
              <div class="resume-option">
                <span>{{ r.name }}</span>
                <el-tag
                  v-if="r.parseStatus !== 'SUCCESS'"
                  size="small"
                  type="info"
                  class="option-tag"
                >
                  未解析
                </el-tag>
              </div>
            </el-option>
          </el-select>
        </div>

        <el-tooltip
          :content="analyzeDisabledReason"
          :disabled="canAnalyze || running"
          placement="top"
        >
          <span>
            <el-button
              type="primary"
              :disabled="!canAnalyze || running"
              :loading="running"
              @click="onStartMatch"
            >
              {{ running ? `分析中 (${elapsed}s)` : analysis ? '重新分析' : '开始匹配分析' }}
            </el-button>
          </span>
        </el-tooltip>
      </div>
    </header>

    <!-- 运行中的秒表加载态 -->
    <div v-if="running" class="running-box">
      <el-progress type="circle" :percentage="Math.min(95, Math.floor((elapsed / 120) * 100))" />
      <div class="running-text">
        <p class="running-title">AI 正在深度比对简历与 JD 的每项要求...</p>
        <p class="running-hint">
          已耗时 {{ elapsed }} 秒。通常需要 1~2 分钟，请稍候（不会覆盖你的原始简历与 JD）。
        </p>
      </div>
    </div>

    <!-- 未分析过的引导空状态 -->
    <div v-else-if="!analysis" class="empty-box">
      <el-empty
        description="暂无匹配分析报告。选择一份已解析的简历，点击「开始匹配分析」即可诊断。"
      />
    </div>

    <!-- 匹配报告主体 -->
    <div v-else v-loading="loadingAnalysis" class="report-body">
      <!-- 概览总结区 -->
      <section class="summary-card">
        <div class="summary-head">
          <div class="score-badge">
            <span class="score-num">{{ analysis.overallScore }}</span>
            <span class="score-label">匹配参考分</span>
          </div>
          <div class="summary-text-wrap">
            <div class="summary-title-row">
              <span class="summary-title">综合判定摘要</span>
              <span class="time-hint">分析于 {{ formatDateTime(analysis.createdAt) }}</span>
            </div>
            <p class="summary-desc">{{ analysis.summary }}</p>
          </div>
        </div>

        <!-- 技能与经历快速对比 -->
        <div class="matrix-grid">
          <!-- 技能 -->
          <div class="matrix-col">
            <h4 class="matrix-title">技能对齐</h4>
            <div class="tag-group">
              <span class="group-label group-label--ok">已匹配:</span>
              <div v-if="analysis.matchedSkills.length" class="chips">
                <el-tag
                  v-for="s in analysis.matchedSkills"
                  :key="s"
                  type="success"
                  size="small"
                  effect="plain"
                >
                  {{ s }}
                </el-tag>
              </div>
              <span v-else class="text-none">无明确匹配</span>
            </div>
            <div class="tag-group">
              <span class="group-label group-label--gap">缺失项:</span>
              <div v-if="analysis.missingSkills.length" class="chips">
                <el-tag
                  v-for="s in analysis.missingSkills"
                  :key="s"
                  type="danger"
                  size="small"
                  effect="plain"
                >
                  {{ s }}
                </el-tag>
              </div>
              <span v-else class="text-none">无显著技能缺口</span>
            </div>
          </div>

          <!-- 经历 -->
          <div class="matrix-col">
            <h4 class="matrix-title">经验对齐</h4>
            <div class="tag-group">
              <span class="group-label group-label--ok">符合经验:</span>
              <ul v-if="analysis.matchedExperience.length" class="exp-list">
                <li v-for="(e, i) in analysis.matchedExperience" :key="i">{{ e }}</li>
              </ul>
              <span v-else class="text-none">未体现对应经验</span>
            </div>
            <div class="tag-group">
              <span class="group-label group-label--gap">不足经验:</span>
              <ul v-if="analysis.missingExperience.length" class="exp-list exp-list--gap">
                <li v-for="(e, i) in analysis.missingExperience" :key="i">{{ e }}</li>
              </ul>
              <span v-else class="text-none">经历整体符合</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 五类结论逐条分析 -->
      <section class="verdicts-section">
        <div class="tabs-header">
          <div class="tabs-group">
            <button
              type="button"
              class="tab-btn"
              :class="{ 'tab-btn--active': activeTab === 'ALL' }"
              @click="activeTab = 'ALL'"
            >
              全部要求 ({{ countByVerdict['ALL'] || 0 }})
            </button>
            <button
              v-for="(meta, v) in VERDICT_META"
              :key="v"
              type="button"
              class="tab-btn"
              :class="{
                'tab-btn--active': activeTab === v,
                [`tab-btn--${meta.tagType}`]: true,
              }"
              @click="activeTab = v"
            >
              {{ meta.label }} ({{ countByVerdict[v] || 0 }})
            </button>
          </div>
          <p class="tabs-note">
            💡 优先处理<strong>真实缺口</strong>与<strong>表达缺口</strong>，可显著提升简历通过率。
          </p>
        </div>

        <div v-if="sortedItems.length" class="items-list">
          <div
            v-for="(item, idx) in sortedItems"
            :key="idx"
            class="verdict-item"
            :class="`verdict-item--${item.verdict.toLowerCase()}`"
          >
            <div class="item-head">
              <div class="item-tags">
                <el-tag :type="VERDICT_META[item.verdict].tagType" effect="dark" size="small">
                  {{ VERDICT_META[item.verdict].label }}
                </el-tag>
                <el-tag size="small" type="info">
                  {{ CATEGORY_LABELS[item.category] }}
                </el-tag>
              </div>
              <h5 class="item-req">{{ item.requirement }}</h5>
            </div>

            <!-- 简历原文证据（若有） -->
            <div v-if="item.evidence" class="item-evidence">
              <span class="evidence-tag">简历原文依据:</span>
              <blockquote class="evidence-quote">“{{ item.evidence }}”</blockquote>
            </div>

            <!-- 行动指导建议 -->
            <div class="item-advice">
              <el-icon><Check /></el-icon>
              <div class="advice-content">
                <strong>行动建议：</strong>
                <span>{{ item.advice }}</span>
              </div>
            </div>
          </div>
        </div>

        <el-empty v-else description="该分类下没有相关条目" :image-size="60" />
      </section>

      <!-- 宏观提升建议 -->
      <section v-if="analysis.suggestions.length" class="suggestions-box">
        <h4 class="suggestions-title">💡 针对本岗位的投递建议</h4>
        <ul class="suggestions-list">
          <li v-for="(s, i) in analysis.suggestions" :key="i">{{ s }}</li>
        </ul>
      </section>
    </div>
  </el-card>
</template>

<style scoped>
.match-panel {
  margin-top: var(--mf-space-5);
  border-radius: var(--mf-radius-lg);
}

.match-head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-4);
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--mf-space-4);
  border-bottom: 1px solid var(--mf-glass-border-soft);
}

.match-head__title {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
  margin: 0 0 var(--mf-space-1);
  font-size: var(--mf-font-md);
  font-weight: var(--mf-weight-medium);
}

.match-head__sub {
  margin: 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.match-head__ctrl {
  display: flex;
  gap: var(--mf-space-3);
  align-items: center;
}

.resume-picker {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
}

.picker-label {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.resume-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.option-tag {
  margin-left: var(--mf-space-2);
}

/* 运行态 */
.running-box {
  display: flex;
  gap: var(--mf-space-5);
  align-items: center;
  justify-content: center;
  padding: var(--mf-space-8) 0;
}

.running-title {
  margin: 0 0 var(--mf-space-1);
  font-size: var(--mf-font-md);
  font-weight: var(--mf-weight-medium);
}

.running-hint {
  margin: 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.empty-box {
  padding: var(--mf-space-6) 0;
}

/* 报告主体 */
.report-body {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-5);
  margin-top: var(--mf-space-4);
}

.summary-card {
  padding: var(--mf-space-4);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-md);
  border: 1px solid var(--mf-glass-border-soft);
}

.summary-head {
  display: flex;
  gap: var(--mf-space-4);
  align-items: flex-start;
  margin-bottom: var(--mf-space-4);
}

.score-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 80px;
  padding: var(--mf-space-2);
  background-color: var(--mf-bg-surface);
  border: 1px solid var(--mf-primary);
  border-radius: var(--mf-radius-md);
}

.score-num {
  font-size: var(--mf-font-2xl);
  font-weight: var(--mf-weight-bold);
  color: var(--mf-primary);
  line-height: 1;
}

.score-label {
  margin-top: var(--mf-space-1);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.summary-text-wrap {
  flex: 1;
}

.summary-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--mf-space-1);
}

.summary-title {
  font-weight: var(--mf-weight-medium);
}

.time-hint {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.summary-desc {
  margin: 0;
  font-size: var(--mf-font-sm);
  line-height: 1.6;
  color: var(--mf-text-secondary);
}

/* 技能与经历对比 */
.matrix-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--mf-space-4);
  padding-top: var(--mf-space-3);
  border-top: 1px dashed var(--mf-glass-border-soft);
}

.matrix-title {
  margin: 0 0 var(--mf-space-2);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.tag-group {
  display: flex;
  gap: var(--mf-space-2);
  align-items: flex-start;
  margin-bottom: var(--mf-space-2);
}

.group-label {
  flex: none;
  font-size: var(--mf-font-xs);
  font-weight: var(--mf-weight-medium);
}

.group-label--ok {
  color: var(--mf-success);
}

.group-label--gap {
  color: var(--mf-danger);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-1);
}

.text-none {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.exp-list {
  margin: 0;
  padding-left: var(--mf-space-4);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.exp-list--gap {
  color: var(--mf-danger);
}

/* 结论 Tab */
.tabs-header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-2);
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--mf-space-3);
}

.tabs-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-1);
}

.tab-btn {
  padding: var(--mf-space-1) var(--mf-space-3);
  font-size: var(--mf-font-xs);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-pill);
  background: var(--mf-bg-subtle);
  color: var(--mf-text-secondary);
  cursor: pointer;
  transition: all var(--mf-duration-fast) var(--mf-ease-out);
}

.tab-btn:hover {
  background-color: var(--mf-bg-surface);
  color: var(--mf-text-primary);
}

.tab-btn--active {
  background-color: var(--mf-primary);
  border-color: var(--mf-primary);
  color: #fff;
}

.tabs-note {
  margin: 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

/* 逐条清单卡片 */
.items-list {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3);
}

.verdict-item {
  padding: var(--mf-space-4);
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-left-width: 4px;
  border-radius: var(--mf-radius-md);
  transition: transform var(--mf-duration-fast) var(--mf-ease-out);
}

.verdict-item--real_gap {
  border-left-color: var(--mf-danger);
}

.verdict-item--expression_gap {
  border-left-color: var(--mf-warning);
}

.verdict-item--insufficient_evidence {
  border-left-color: var(--mf-warning);
}

.verdict-item--uncertain {
  border-left-color: var(--mf-text-tertiary);
}

.verdict-item--matched {
  border-left-color: var(--mf-success);
}

.item-head {
  display: flex;
  gap: var(--mf-space-2);
  align-items: baseline;
  margin-bottom: var(--mf-space-2);
}

.item-tags {
  display: flex;
  gap: var(--mf-space-1);
}

.item-req {
  margin: 0;
  font-size: var(--mf-font-sm);
  font-weight: var(--mf-weight-medium);
}

.item-evidence {
  margin-bottom: var(--mf-space-2);
  padding: var(--mf-space-2) var(--mf-space-3);
  font-size: var(--mf-font-xs);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-sm);
}

.evidence-tag {
  color: var(--mf-text-tertiary);
  margin-right: var(--mf-space-1);
}

.evidence-quote {
  display: inline;
  margin: 0;
  font-style: italic;
  color: var(--mf-text-secondary);
}

.item-advice {
  display: flex;
  gap: var(--mf-space-2);
  align-items: flex-start;
  padding: var(--mf-space-2);
  font-size: var(--mf-font-xs);
  background-color: var(--mf-primary-subtle);
  border-radius: var(--mf-radius-sm);
  color: var(--mf-primary-text);
}

.advice-content {
  line-height: 1.5;
}

/* 总体建议 */
.suggestions-box {
  padding: var(--mf-space-4);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-md);
}

.suggestions-title {
  margin: 0 0 var(--mf-space-2);
  font-size: var(--mf-font-sm);
  font-weight: var(--mf-weight-medium);
}

.suggestions-list {
  margin: 0;
  padding-left: var(--mf-space-4);
  font-size: var(--mf-font-xs);
  line-height: 1.7;
  color: var(--mf-text-secondary);
}
</style>
