<script setup lang="ts">
import { Check, Close, Document, Search, TrendCharts, Warning } from '@element-plus/icons-vue'
import { computed, onMounted, ref } from 'vue'

import {
  BizError,
  type AtsKeywordVO,
  type AtsScoreVO,
  type JobVO,
} from '@mindforge/shared'

import { resumeApi } from '@/api/resume'
import { jobApi } from '@/api/job'

/**
 * ATS 关键词跑分面板 —— 挂在简历详情页。
 *
 * ⚠️ 和「简历-JD 匹配分析」是两件事，页面文案必须分清：
 *   这个是「机器筛简历」的视角 —— JD 里的关键词在简历里出现了没有，
 *   纯本地算、毫秒级、同一输入永远同一分；匹配分析是「能力够不够」的人的视角。
 * 混成一句话讲，用户会拿着 ATS 高分去投一个其实不匹配的岗。
 */

const props = defineProps<{
  resumeId: string
}>()

const jobs = ref<JobVO[]>([])
const selectedJobId = ref('')
const loadingJobs = ref(false)
const loadingScore = ref(false)
const result = ref<AtsScoreVO | null>(null)

const selectedJob = computed(() =>
  jobs.value.find((j) => String(j.id) === String(selectedJobId.value)),
)

/** JD 必须解析过才有技能项可对 —— 没解析就 Match 不了 */
const jobParsed = computed(() => selectedJob.value?.parseStatus === 'SUCCESS')

const canScore = computed(() => Boolean(selectedJobId.value) && jobParsed.value)

const disabledReason = computed(() => {
  if (!selectedJobId.value) return '请先选择一个目标职位'
  if (!jobParsed.value) return '该职位还没有解析过，请先解析 JD'
  return ''
})

/** 分数档位 → 颜色。HIGH ≥80 / MEDIUM ≥60 / LOW 其他 */
const levelColor = computed(() => {
  switch (result.value?.level) {
    case 'HIGH':
      return 'var(--mf-success)'
    case 'MEDIUM':
      return 'var(--mf-warning)'
    default:
      return 'var(--mf-danger)'
  }
})

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

async function loadJobs(): Promise<void> {
  loadingJobs.value = true
  try {
    const data = await jobApi.page({ page: 1, pageSize: 100 })
    jobs.value = data.records
    // 默认选中第一个已解析成功的 JD，省一次点击
    const parsedOne = data.records.find((j) => j.parseStatus === 'SUCCESS')
    if (parsedOne) selectedJobId.value = String(parsedOne.id)
  } catch (e) {
    fail(e, '职位列表加载失败')
  } finally {
    loadingJobs.value = false
  }
}

async function score(): Promise<void> {
  if (!canScore.value) return
  loadingScore.value = true
  result.value = null
  try {
    result.value = await resumeApi.atsScore(props.resumeId, selectedJobId.value)
  } catch (e) {
    fail(e, '跑分失败')
  } finally {
    loadingScore.value = false
  }
}

/** 关键词按「缺失必须项 → 命中 → 缺失加分项」排，最该处理的排最前 */
const sortedKeywords = computed<AtsKeywordVO[]>(() => {
  const list = [...(result.value?.keywords ?? [])]
  const rank = (k: AtsKeywordVO): number => {
    if (k.required && !k.hit) return 0
    if (k.hit) return 1
    return 2
  }
  return list.sort((a, b) => rank(a) - rank(b))
})

function keywordClass(k: AtsKeywordVO): string {
  if (k.required && !k.hit) return 'kw kw--missing-required'
  if (k.hit) return k.hitSource === 'TEXT' ? 'kw kw--text' : 'kw kw--hit'
  return 'kw kw--missing'
}

onMounted(loadJobs)
</script>

<template>
  <el-card class="ats" shadow="never">
    <template #header>
      <div class="ats__head">
        <div class="ats__title">
          <el-icon><TrendCharts /></el-icon>
          <span>ATS 关键词跑分</span>
          <el-tooltip
            effect="dark"
            placement="top"
            content="机器筛简历的视角：只算 JD 里的关键词在简历里出现了没有。纯本地计算，毫秒级返回，同一输入永远同一分。能力匹不匹配请看上面的「简历-JD 匹配分析」。"
          >
            <el-icon class="ats__help"><Warning /></el-icon>
          </el-tooltip>
        </div>
        <div class="ats__controls">
          <el-select
            v-model="selectedJobId"
            placeholder="选择目标职位"
            filterable
            :loading="loadingJobs"
            style="width: 220px"
            @change="result = null"
          >
            <el-option
              v-for="j in jobs"
              :key="j.id"
              :value="String(j.id)"
              :label="j.companyName ? `${j.companyName} · ${j.title}` : j.title"
              :disabled="j.parseStatus !== 'SUCCESS'"
            >
              <span>{{ j.companyName ? `${j.companyName} · ${j.title}` : j.title }}</span>
              <span v-if="j.parseStatus !== 'SUCCESS'" class="ats__option-note">（未解析）</span>
            </el-option>
          </el-select>
          <el-button
            type="primary"
            :loading="loadingScore"
            :disabled="!canScore"
            :title="disabledReason"
            @click="score"
          >
            <el-icon><Search /></el-icon>
            开始跑分
          </el-button>
        </div>
      </div>
    </template>

    <!-- 空态 -->
    <el-empty v-if="!result" description="选择一个已解析的目标职位，看看简历能不能过机器初筛" :image-size="70" />

    <div v-else class="ats__body">
      <!-- 总分 -->
      <div class="ats__score">
        <div class="ats__score-num" :style="{ color: levelColor }">
          {{ result.score.toFixed(1) }}
          <span class="ats__score-unit">分</span>
        </div>
        <div class="ats__score-meta">
          <div class="ats__summary">{{ result.summary }}</div>
          <div class="ats__stats">
            <span>关键词命中 {{ result.matchedKeywords }}/{{ result.totalKeywords }}</span>
            <span class="ats__dot">·</span>
            <span>必须项 {{ result.requiredMatched }}/{{ result.requiredTotal }}</span>
          </div>
        </div>
      </div>

      <!-- 缺失的必须项：最该先处理的，放最显眼 -->
      <div v-if="result.missingRequired.length" class="ats__missing">
        <div class="ats__missing-title">
          <el-icon><Close /></el-icon>
          缺失的必须项（{{ result.missingRequired.length }}）
        </div>
        <div class="ats__kws">
          <span
            v-for="k in result.missingRequired"
            :key="k.keyword"
            class="kw kw--missing-required"
          >{{ k.keyword }}</span>
        </div>
      </div>

      <!-- 关键词标签墙 -->
      <div class="ats__section">
        <div class="ats__section-title">关键词覆盖</div>
        <div class="ats__kws">
          <span
            v-for="k in sortedKeywords"
            :key="k.keyword"
            :class="keywordClass(k)"
          >
            <el-icon v-if="k.hit" class="kw__icon"><Check /></el-icon>
            <el-icon v-else class="kw__icon"><Close /></el-icon>
            {{ k.keyword }}
            <em v-if="k.hitSource === 'TEXT'" class="kw__tag">仅正文</em>
          </span>
        </div>
      </div>

      <!-- 建议 -->
      <div v-if="result.advice.length" class="ats__section">
        <div class="ats__section-title">
          <el-icon><Document /></el-icon>
          建议
        </div>
        <ul class="ats__advice">
          <li v-for="a in result.advice" :key="a">{{ a }}</li>
        </ul>
      </div>

      <!-- 免责说明：原样展示，避免用户把覆盖率误解成能力评分 -->
      <div class="ats__disclaimer">{{ result.disclaimer }}</div>
    </div>
  </el-card>
</template>

<style scoped>
.ats {
  margin-bottom: var(--mf-space-4, 16px);
}

.ats__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--mf-space-3, 12px);
  flex-wrap: wrap;
}

.ats__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.ats__help {
  color: var(--mf-text-tertiary);
  cursor: help;
}

.ats__controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ats__option-note {
  color: var(--mf-text-tertiary);
  font-size: var(--mf-font-xs, 12px);
  margin-left: 4px;
}

.ats__body {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-4, 16px);
}

.ats__score {
  display: flex;
  align-items: center;
  gap: var(--mf-space-4, 16px);
}

.ats__score-num {
  font-size: var(--mf-font-xl);
  font-weight: 500;
  line-height: 1;
  min-width: 96px;
}

.ats__score-unit {
  font-size: var(--mf-font-sm, 13px);
  font-weight: 400;
  color: var(--mf-text-secondary);
  margin-left: 4px;
}

.ats__score-meta {
  flex: 1;
}

.ats__summary {
  color: var(--mf-text-primary);
  line-height: 1.6;
}

.ats__stats {
  margin-top: 4px;
  font-size: var(--mf-font-xs, 12px);
  color: var(--mf-text-tertiary);
}

.ats__dot {
  margin: 0 6px;
}

.ats__missing {
  padding: var(--mf-space-3, 12px);
  border-radius: var(--mf-radius-md, 8px);
  border: 1px solid var(--mf-danger);
}

.ats__missing-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--mf-danger);
  font-weight: 500;
  margin-bottom: 8px;
}

.ats__section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--mf-font-sm, 13px);
  color: var(--mf-text-secondary);
  margin-bottom: 8px;
}

.ats__kws {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.kw {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: var(--mf-radius-pill, 999px);
  font-size: var(--mf-font-sm, 13px);
  border: 1px solid var(--mf-glass-border-soft);
}

.kw__icon {
  font-size: 12px;
}

.kw__tag {
  font-style: normal;
  font-size: var(--mf-font-xs, 12px);
  color: var(--mf-text-tertiary);
}

.kw--hit {
  color: var(--mf-success);
}

.kw--text {
  color: var(--mf-warning);
}

.kw--missing {
  color: var(--mf-text-tertiary);
}

.kw--missing-required {
  color: var(--mf-danger);
  border-color: var(--mf-danger);
}

.ats__advice {
  margin: 0;
  padding-left: 20px;
  color: var(--mf-text-secondary);
  line-height: 1.8;
}

.ats__disclaimer {
  padding: var(--mf-space-2, 8px) var(--mf-space-3, 12px);
  border-radius: var(--mf-radius-md, 8px);
  font-size: var(--mf-font-xs, 12px);
  color: var(--mf-text-tertiary);
  background: var(--mf-bg-subtle);
  line-height: 1.6;
}
</style>
