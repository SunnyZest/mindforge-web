<script setup lang="ts">
import { Refresh, Back, EditPen } from '@element-plus/icons-vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  BizError,
  formatBytes,
  formatDateTime,
  type ResumeDetailVO,
  type ResumeOptimizeItem,
  type StructuredResume,
} from '@mindforge/shared'

import { resumeApi } from '@/api/resume'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import ResumeOptimizePanel from '@/components/ResumeOptimizePanel.vue'
import ResumeStudioDialog from '@/components/ResumeStudioDialog.vue'

const route = useRoute()
const router = useRouter()

const id = computed(() => String(route.params.id))
const loading = ref(false)
const parsing = ref(false)
const studioVisible = ref(false)
const detail = ref<ResumeDetailVO | null>(null)

/** 结构化里被点中的字段值 —— 点它就在左边原文里高亮出来 */
const highlight = ref('')
/** 高亮命中的位置（没命中就是 -1），用来提示「原文里找不到」 */
const hitIndex = ref(-1)

const rawRef = ref<HTMLElement>()

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

async function load(options: { silent?: boolean } = {}): Promise<void> {
  const { silent = false } = options
  if (!silent) loading.value = true
  try {
    detail.value = await resumeApi.detail(id.value)
  } catch (e) {
    if (!silent) fail(e, '加载失败')
  } finally {
    if (!silent) loading.value = false
  }
}

/** 解析中是后端异步跑的 —— 用同一套轮询逻辑盯着 */
const {
  active: refreshing,
  exhausted,
  resume,
} = useAutoRefresh({
  shouldContinue: () => detail.value?.parseStatus === 'PARSING',
  onRefresh: () => load({ silent: true }),
})

async function onParse(): Promise<void> {
  parsing.value = true
  try {
    await resumeApi.parse(id.value)
    ElMessage.success('已提交解析，稍等片刻')
    await load()
  } catch (e) {
    fail(e, '提交解析失败')
  } finally {
    parsing.value = false
  }
}

/**
 * 一键采纳 AI 改写建议：
 * 1. 在简历原文 (`rawContent`) 和结构化经历 (`structuredJson`) 中用 `rewritten` 替换 `original`（或追加到对应板块）
 * 2. 调用 `PUT /api/app/resumes/{id}` 持久化保存
 * 3. 自动在左侧原文中高亮刚刚采纳的句子
 */
async function onApplyRewrite(item: ResumeOptimizeItem): Promise<void> {
  if (!detail.value || !item.rewritten) return

  const orig = (item.original ?? '').trim()
  const rewritten = item.rewritten.trim()
  let nextRaw = detail.value.rawContent ?? ''
  let replacedInRaw = false

  if (orig && nextRaw.includes(orig)) {
    nextRaw = nextRaw.replace(orig, rewritten)
    replacedInRaw = true
  } else if (rewritten && !nextRaw.includes(rewritten)) {
    nextRaw = nextRaw ? `${nextRaw}\n${rewritten}` : rewritten
  }

  let nextStructured: StructuredResume | undefined
  if (detail.value.structuredJson) {
    nextStructured = JSON.parse(JSON.stringify(detail.value.structuredJson)) as StructuredResume
    if (orig) {
      if (nextStructured.summary?.includes(orig)) {
        nextStructured.summary = nextStructured.summary.replace(orig, rewritten)
      }
      if (nextStructured.selfEvaluation?.includes(orig)) {
        nextStructured.selfEvaluation = nextStructured.selfEvaluation.replace(orig, rewritten)
      }
      for (const w of nextStructured.workExperience) {
        if (w.description?.includes(orig)) {
          w.description = w.description.replace(orig, rewritten)
        }
      }
      for (const p of nextStructured.projects) {
        if (p.description?.includes(orig)) {
          p.description = p.description.replace(orig, rewritten)
        }
      }
    }
  }

  try {
    const updated = await resumeApi.update(id.value, {
      name: detail.value.name,
      targetPosition: detail.value.targetPosition ?? undefined,
      summary: nextStructured?.summary ?? detail.value.summary ?? undefined,
      rawContent: nextRaw,
      structuredJson: nextStructured,
    })
    detail.value = updated
    ElMessage.success(
      replacedInRaw
        ? '已一键替换到简历原文与结构化内容，可点击右上角导出 PDF'
        : '已采纳并追加到简历内容，可在「在线精修 / 导出 PDF」中微调排版',
    )
    await locate(rewritten)
  } catch (e) {
    fail(e, '采纳保存失败')
  }
}

function onStudioSaved(updated: ResumeDetailVO): void {
  detail.value = updated
}

// ---------- 原文 / 结构化 对照 ----------
/**
 * 把原文按 `highlight` 切成三段，中间那段高亮。
 *
 * ⚠️ 用 `indexOf` 而不是正则：结构化里的值可能是 `C++`、`(Java)` 这种
 *    带正则元字符的字符串，直接塞进 RegExp 会报错或者匹配到别的地方。
 *    这里只需要「找到第一处」，indexOf 又准又快。
 */
const rawParts = computed(() => {
  const text = detail.value?.rawContent ?? ''
  const needle = highlight.value
  if (!text || !needle) return { before: text, hit: '', after: '' }

  const i = text.toLowerCase().indexOf(needle.toLowerCase())
  if (i < 0) return { before: text, hit: '', after: '' }

  return {
    before: text.slice(0, i),
    hit: text.slice(i, i + needle.length),
    after: text.slice(i + needle.length),
  }
})

const hasHit = computed(() => rawParts.value.hit !== '')

/** 点结构化里的某个值 → 在原文里定位并滚过去 */
async function locate(value: string | null | undefined): Promise<void> {
  if (!value) return
  highlight.value = value
  hitIndex.value = -1
  await nextTick()

  if (!hasHit.value) {
    hitIndex.value = -2 // 用 -2 表示「原文里没找到」，和「还没点过」区分开
    return
  }
  hitIndex.value = 1
  rawRef.value?.querySelector('mark')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

// 换简历时清掉高亮，否则会残留上一份的定位
watch(id, () => {
  highlight.value = ''
  hitIndex.value = -1
})

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="page">
    <!-- ---------- 头部 ---------- -->
    <header class="head">
      <el-button text :icon="Back" @click="router.push({ name: 'resumes' })">返回列表</el-button>

      <div class="head__main">
        <h1 class="head__title">{{ detail?.name ?? '简历' }}</h1>
        <p class="head__meta">
          {{ detail?.targetPosition || '未填目标职位' }} · {{ formatBytes(detail?.fileSize) }} ·
          上传于 {{ formatDateTime(detail?.createdAt) }}
        </p>
      </div>

      <div class="head__actions">
        <span v-if="refreshing || exhausted" class="refresh">
          <span class="refresh__dot" :class="{ 'refresh__dot--on': refreshing }" />
          {{ exhausted ? '自动刷新已暂停' : '解析中…' }}
          <el-button v-if="exhausted" link type="primary" @click="resume">继续</el-button>
        </span>

        <el-button
          type="primary"
          plain
          :icon="EditPen"
          :disabled="!detail"
          @click="studioVisible = true"
        >
          在线精修 / 导出 PDF
        </el-button>

        <el-button
          :icon="Refresh"
          :loading="parsing"
          :disabled="detail?.parseStatus === 'PARSING'"
          @click="onParse"
        >
          {{ detail?.parseStatus === 'SUCCESS' ? '重新解析' : '解析' }}
        </el-button>
      </div>
    </header>

    <!-- 解析失败要说清原因，别只显示一个红标签 -->
    <el-alert
      v-if="detail?.parseStatus === 'FAILED'"
      type="error"
      :closable="false"
      show-icon
      title="解析失败"
      :description="detail.errorMessage || '原因未知，可以点「重试」再试一次'"
    />

    <!-- ---------- 对照区 ---------- -->
    <div class="split">
      <!-- 左：原文 -->
      <section class="pane">
        <h2 class="pane__title">简历原文</h2>
        <pre ref="rawRef" class="raw">{{ rawParts.before }}<mark
            v-if="rawParts.hit"
            class="raw__hit"
          >{{ rawParts.hit }}</mark>{{ rawParts.after }}</pre>

        <p v-if="hitIndex === -2" class="pane__note">
          「{{ highlight }}」在原文里没找到 —— 可能是 AI 归纳过的说法，不是原句照抄。
        </p>
      </section>

      <!-- 右：结构化 -->
      <section class="pane">
        <h2 class="pane__title">
          结构化结果
          <span v-if="!detail?.structuredJson" class="pane__hint">（还没解析）</span>
        </h2>

        <el-empty
          v-if="!detail?.structuredJson"
          :image-size="80"
          description="点上面的「解析」，AI 会读出你的经历、技能和项目"
        />

        <div v-else class="s">
          <!-- 摘要 -->
          <div v-if="detail.summary || detail.structuredJson.summary" class="s__block">
            <h3 class="s__label">一句话概括</h3>
            <p class="s__text">{{ detail.summary || detail.structuredJson.summary }}</p>
          </div>

          <!-- 基本信息 -->
          <div class="s__block">
            <h3 class="s__label">基本信息</h3>
            <div class="s__rows">
              <span v-if="detail.structuredJson.name" class="s__row">
                <em>姓名</em>
                <button type="button" class="s__val" @click="locate(detail.structuredJson.name)">
                  {{ detail.structuredJson.name }}
                </button>
              </span>
              <span v-if="detail.structuredJson.yearsOfExperience" class="s__row">
                <em>经验</em>{{ detail.structuredJson.yearsOfExperience }} 年
              </span>
              <span v-if="detail.structuredJson.location" class="s__row">
                <em>城市</em>
                <button
                  type="button"
                  class="s__val"
                  @click="locate(detail.structuredJson.location)"
                >
                  {{ detail.structuredJson.location }}
                </button>
              </span>
              <span v-if="detail.structuredJson.email" class="s__row">
                <em>邮箱</em>{{ detail.structuredJson.email }}
              </span>
              <span v-if="detail.structuredJson.phone" class="s__row">
                <em>电话</em>{{ detail.structuredJson.phone }}
              </span>
            </div>
          </div>

          <!-- 技能 —— 点一个就在原文里高亮出来，这是「对照」最直观的地方 -->
          <div v-if="detail.structuredJson.skills.length" class="s__block">
            <h3 class="s__label">
              技能
              <span class="s__count">{{ detail.structuredJson.skills.length }}</span>
            </h3>
            <div class="chips">
              <button
                v-for="sk in detail.structuredJson.skills"
                :key="sk.name"
                type="button"
                class="chip"
                @click="locate(sk.name)"
              >
                {{ sk.name }}
                <span v-if="sk.years" class="chip__extra">{{ sk.years }}年</span>
              </button>
            </div>
          </div>

          <!-- 工作经历 -->
          <div v-if="detail.structuredJson.workExperience.length" class="s__block">
            <h3 class="s__label">工作经历</h3>
            <div v-for="(w, i) in detail.structuredJson.workExperience" :key="i" class="entry">
              <div class="entry__head">
                <button type="button" class="entry__title" @click="locate(w.company)">
                  {{ w.company }}
                </button>
                <span class="entry__period">{{ w.startDate }} ~ {{ w.endDate || '至今' }}</span>
              </div>
              <p v-if="w.position" class="entry__sub">{{ w.position }}</p>
              <p v-if="w.description" class="entry__desc">{{ w.description }}</p>
            </div>
          </div>

          <!-- 项目 -->
          <div v-if="detail.structuredJson.projects.length" class="s__block">
            <h3 class="s__label">项目经历</h3>
            <div v-for="(p, i) in detail.structuredJson.projects" :key="i" class="entry">
              <div class="entry__head">
                <button type="button" class="entry__title" @click="locate(p.name)">
                  {{ p.name }}
                </button>
                <span v-if="p.role" class="entry__period">{{ p.role }}</span>
              </div>
              <div v-if="p.techStack.length" class="chips chips--sm">
                <button
                  v-for="t in p.techStack"
                  :key="t"
                  type="button"
                  class="chip chip--plain"
                  @click="locate(t)"
                >
                  {{ t }}
                </button>
              </div>
              <p v-if="p.description" class="entry__desc">{{ p.description }}</p>
            </div>
          </div>

          <!-- 教育 -->
          <div v-if="detail.structuredJson.education.length" class="s__block">
            <h3 class="s__label">教育经历</h3>
            <div v-for="(e, i) in detail.structuredJson.education" :key="i" class="entry">
              <div class="entry__head">
                <button type="button" class="entry__title" @click="locate(e.school)">
                  {{ e.school }}
                </button>
                <span class="entry__period">
                  {{ e.startYear ?? '' }}{{ e.endYear ? ' ~ ' + e.endYear : '' }}
                </span>
              </div>
              <p v-if="e.major || e.degree" class="entry__sub">
                {{ [e.major, e.degree].filter(Boolean).join(' · ') }}
              </p>
            </div>
          </div>

          <!-- 证书 -->
          <div v-if="detail.structuredJson.certificates.length" class="s__block">
            <h3 class="s__label">证书 / 奖项</h3>
            <div class="chips">
              <button
                v-for="c in detail.structuredJson.certificates"
                :key="c"
                type="button"
                class="chip"
                @click="locate(c)"
              >
                {{ c }}
              </button>
            </div>
          </div>

          <!-- 自我评价 -->
          <div v-if="detail.structuredJson.selfEvaluation" class="s__block">
            <h3 class="s__label">自我评价</h3>
            <p class="s__text">{{ detail.structuredJson.selfEvaluation }}</p>
          </div>
        </div>
      </section>
    </div>

    <!-- ---------- AI 优化 ---------- -->
    <ResumeOptimizePanel
      :resume-id="id"
      :disabled="detail?.parseStatus !== 'SUCCESS'"
      @apply-rewrite="onApplyRewrite"
    />

    <!-- ---------- 在线精修与 A4 PDF 导出工作台 ---------- -->
    <ResumeStudioDialog
      v-model="studioVisible"
      :detail="detail"
      @saved="onStudioSaved"
    />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-5);
  max-width: 1280px;
  margin: 0 auto;
}

/* ---------- 头部 ---------- */
.head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-4);
  align-items: center;
}

.head__main {
  flex: 1;
  min-width: 0;
}

.head__title {
  margin: 0 0 var(--mf-space-1);
  font-size: var(--mf-font-xl);
  font-weight: var(--mf-weight-medium);
  letter-spacing: -0.02em;
}

.head__meta {
  margin: 0;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
}

.head__actions {
  display: flex;
  gap: var(--mf-space-3);
  align-items: center;
}

.refresh {
  display: inline-flex;
  gap: var(--mf-space-2);
  align-items: center;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
}

.refresh__dot {
  width: 6px;
  height: 6px;
  background-color: var(--mf-text-tertiary);
  border-radius: 50%;
}

.refresh__dot--on {
  background-color: var(--mf-primary);
  animation: pulse 1.6s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .refresh__dot--on {
    animation: none;
  }
}

/* ---------- 左右对照 ---------- */
.split {
  display: grid;
  /* ★ 两栏等宽 —— 「对照」的重点就是两边都看得见，一边宽一边窄会让人只看宽的那边 */
  grid-template-columns: 1fr 1fr;
  gap: var(--mf-space-5);
  align-items: start;
}

/* 窄屏堆成一列 —— 硬撑着两栏会让两边都挤得没法看 */
@media (width <= 1000px) {
  .split {
    grid-template-columns: 1fr;
  }
}

.pane {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3);
  padding: var(--mf-space-5);
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
}

.pane__title {
  display: flex;
  gap: var(--mf-space-2);
  align-items: baseline;
  margin: 0;
  font-size: var(--mf-font-sm);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-secondary);
}

.pane__hint {
  font-size: var(--mf-font-xs);
  font-weight: 400;
  color: var(--mf-text-tertiary);
}

.pane__note {
  margin: 0;
  font-size: var(--mf-font-xs);
  line-height: 1.6;
  color: var(--mf-text-tertiary);
}

/* 原文用 pre 保留换行 —— 简历的排版（缩进、分行）本身就是信息，
   当成普通段落会全糊成一坨 */
.raw {
  max-height: 640px;
  margin: 0;
  overflow-y: auto;
  font-family: inherit;
  font-size: var(--mf-font-sm);
  line-height: 1.8;
  color: var(--mf-text-secondary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.raw__hit {
  padding: 1px 2px;
  color: var(--mf-text-primary);
  background-color: var(--mf-warning-subtle);
  border-radius: 3px;
  /* 高亮闪一下，让眼睛能跟上（滚过去之后知道看哪儿） */
  animation: flash 1.2s var(--mf-ease-out);
}

@keyframes flash {
  0% {
    background-color: var(--mf-warning);
  }
  100% {
    background-color: var(--mf-warning-subtle);
  }
}

@media (prefers-reduced-motion: reduce) {
  .raw__hit {
    animation: none;
  }
}

/* ---------- 结构化 ---------- */
.s {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-5);
}

.s__block {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-2);
}

.s__label {
  display: flex;
  gap: var(--mf-space-2);
  align-items: baseline;
  margin: 0;
  font-size: var(--mf-font-xs);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-tertiary);
  letter-spacing: 0.04em;
}

.s__count {
  padding: 0 var(--mf-space-2);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-pill);
}

.s__text {
  margin: 0;
  font-size: var(--mf-font-sm);
  line-height: 1.7;
  color: var(--mf-text-secondary);
}

.s__rows {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-4);
}

.s__row {
  display: inline-flex;
  gap: var(--mf-space-2);
  align-items: baseline;
  font-size: var(--mf-font-sm);
}

.s__row em {
  font-style: normal;
  color: var(--mf-text-tertiary);
}

/* 可点的值 —— 点一下在左边原文里高亮 */
.s__val {
  padding: 0;
  font: inherit;
  color: var(--mf-primary-text);
  cursor: pointer;
  background: none;
  border: none;
}

.s__val:hover {
  text-decoration: underline;
}

/* ---------- 技能 / 标签 ---------- */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-2);
}

.chip {
  display: inline-flex;
  gap: var(--mf-space-1);
  align-items: center;
  padding: 2px var(--mf-space-3);
  font-size: var(--mf-font-xs);
  color: var(--mf-primary-text);
  cursor: pointer;
  background-color: var(--mf-primary-subtle);
  border: none;
  border-radius: var(--mf-radius-pill);
  transition: filter var(--mf-duration-fast) var(--mf-ease-out);
}

.chip:hover {
  filter: brightness(0.96);
}

.chip:focus-visible {
  outline: 2px solid var(--mf-primary);
  outline-offset: 2px;
}

/* 项目技术栈用中性色 —— 和「技能」区分开，不然一屏全是蓝的 */
.chip--plain {
  color: var(--mf-text-secondary);
  background-color: var(--mf-bg-subtle);
}

.chip__extra {
  color: var(--mf-text-tertiary);
}

.chips--sm {
  margin: var(--mf-space-1) 0;
}

/* ---------- 经历条目 ---------- */
.entry {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: var(--mf-space-3);
  border-bottom: 1px solid var(--mf-glass-border-soft);
}

.entry:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.entry__head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-3);
  align-items: baseline;
  justify-content: space-between;
}

.entry__title {
  padding: 0;
  font-size: var(--mf-font-sm);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-primary);
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;
}

.entry__title:hover {
  color: var(--mf-primary-text);
}

.entry__title:focus-visible {
  outline: 2px solid var(--mf-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

.entry__period {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.entry__sub {
  margin: 0;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-secondary);
}

.entry__desc {
  margin: var(--mf-space-1) 0 0;
  font-size: var(--mf-font-sm);
  line-height: 1.7;
  color: var(--mf-text-secondary);
}
</style>
