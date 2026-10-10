<script setup lang="ts">
import { Back, MagicStick, VideoPlay, Promotion, Check, Delete } from '@element-plus/icons-vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  BizError,
  formatDateTime,
  type InterviewDetailVO,
  type InterviewReportVO,
} from '@mindforge/shared'

import { interviewApi } from '@/api/interview'
import InterviewAnalysisView from '@/components/InterviewAnalysisView.vue'
import { useSlowTask } from '@/composables/useSlowTask'

const route = useRoute()
const router = useRouter()

const id = computed(() => String(route.params.id))

const loading = ref(false)
const detail = ref<InterviewDetailVO | null>(null)
const report = ref<InterviewReportVO | null>(null)

/** 当前正在作答的题目下标 */
const cursor = ref(0)
const answerText = ref('')
/** 三个慢接口各自一个秒表 —— 它们不会同时跑，但状态要分开才看得清是哪个在等 */
const generateTask = useSlowTask()
const answerTask = useSlowTask()
const finishTask = useSlowTask()

const TYPE_TEXT: Record<string, string> = {
  TECHNICAL: '技术面',
  BEHAVIORAL: '行为面',
  MIXED: '综合面',
}
const QT_TEXT: Record<string, string> = {
  TECHNICAL: '技术',
  BEHAVIORAL: '行为',
  SITUATIONAL: '情景',
}
const DIFF_TEXT: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }

const questions = computed(() => detail.value?.questions ?? [])
const current = computed(() => questions.value[cursor.value] ?? null)
const answeredCount = computed(() => questions.value.filter((q) => q.answered).length)
const allAnswered = computed(
  () => questions.value.length > 0 && answeredCount.value === questions.value.length,
)

/** 阶段：决定页面显示哪一块 */
const stage = computed(() => {
  const d = detail.value
  // ⚠️ 「还没加载完」和「加载失败了」必须分开。
  //    原来这里只返回 'loading'，而模板里没有 loading 分支 ——
  //    接口一旦失败（比如面试被删了、或 500），页面就是一片空白，
  //    用户完全不知道发生了什么。这是很典型的「正常操作碰不到就不管」的隐患。
  if (!d) return loading.value ? 'loading' : 'failed'
  if (d.status === 'FINISHED') return 'report'
  if (d.questions.length === 0) return 'empty'
  if (d.status === 'CREATED') return 'ready'
  return 'answering'
})

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

async function load(): Promise<void> {
  loading.value = true
  try {
    detail.value = await interviewApi.detail(id.value)
    // 进来时定位到第一道没答的题 —— 续做的人不用自己翻
    const firstUnanswered = detail.value.questions.findIndex((q) => !q.answered)
    cursor.value = firstUnanswered >= 0 ? firstUnanswered : 0
    answerText.value = ''

    if (detail.value.status === 'FINISHED') await loadReport()
  } catch (e) {
    fail(e, '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadReport(): Promise<void> {
  try {
    report.value = await interviewApi.report(id.value)
  } catch {
    // 报告还没生成好（或者失败）—— 不弹错，页面上给个「生成报告」的入口就行
    report.value = null
  }
}

// ---------- 五步流程 ----------
async function onGenerate(): Promise<void> {
  const res = await generateTask
    .run(() => interviewApi.generate(id.value))
    .catch((e) => {
      fail(e, '出题失败，可以重试（这个接口是幂等的）')
      return undefined
    })
  if (res) {
    detail.value = res
    ElMessage.success(`出了 ${res.questions.length} 道题`)
  }
}

async function onStart(): Promise<void> {
  try {
    detail.value = await interviewApi.start(id.value)
    cursor.value = 0
  } catch (e) {
    fail(e, '开始失败')
  }
}

async function onSubmitAnswer(): Promise<void> {
  if (!current.value) return
  if (!answerText.value.trim()) {
    ElMessage.warning('先写点内容再提交')
    return
  }

  const res = await answerTask
    .run(() =>
      interviewApi.answer(id.value, {
        questionId: current.value!.id,
        answer: answerText.value,
      }),
    )
    .catch((e) => {
      fail(e, '提交失败，答案没丢，可以再点一次')
      return undefined
    })
  if (!res) return

  // 把这一题标成已答（本地先更，省一次请求）
  const q = questions.value.find((x) => x.id === res.questionId)
  if (q) {
    q.answered = true
    q.score = res.score
    q.userAnswer = answerText.value
    q.aiAnalysis = res.analysis
  }
  if (detail.value) detail.value.answeredCount = res.answeredCount
}

async function onNext(): Promise<void> {
  answerText.value = ''

  if (cursor.value < questions.value.length - 1) {
    cursor.value += 1
    return
  }
  // 已经是最后一题 —— 提示去结束
  ElMessage.success('都答完了，点右上角「结束并生成报告」')
}

/** 点左侧题号切换 —— 已答的题可以回去看自己的回答和点评 */
function goTo(index: number): void {
  cursor.value = index
  answerText.value = ''
}

async function onFinish(): Promise<void> {
  try {
    await ElMessageBox.confirm('结束后就不能再改了，确认生成报告？', '结束面试', {
      type: 'warning',
      confirmButtonText: '结束并生成报告',
      cancelButtonText: '再检查一下',
    })
  } catch {
    return
  }

  const res = await finishTask
    .run(() => interviewApi.finish(id.value))
    .catch((e) => {
      fail(e, '生成报告失败')
      return undefined
    })
  if (!res) return

  report.value = res
  if (detail.value) detail.value.status = 'FINISHED'
  ElMessage.success('报告已生成')
}

async function onRemove(): Promise<void> {
  try {
    await ElMessageBox.confirm('确定删除这场面试？题目和报告会一起删掉。', '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await interviewApi.remove(id.value)
    await router.replace({ name: 'interviews' })
  } catch (e) {
    fail(e, '删除失败')
  }
}

// 换面试时把所有临时状态清干净，否则会串上一场的内容
watch(id, () => {
  detail.value = null
  report.value = null
  cursor.value = 0
  answerText.value = ''
})

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="page">
    <header class="head">
      <el-button text :icon="Back" @click="router.push({ name: 'interviews' })">返回列表</el-button>

      <div class="head__main">
        <h1 class="head__title">{{ detail?.title ?? '模拟面试' }}</h1>
        <p class="head__meta">
          <template v-if="detail">
            {{ TYPE_TEXT[detail.interviewType] ?? detail.interviewType }} ·
            {{ DIFF_TEXT[detail.difficulty] ?? detail.difficulty }}
            <template v-if="questions.length">
              · 已答 {{ answeredCount }}/{{ questions.length }}</template
            >
          </template>
        </p>
      </div>

      <div class="head__actions">
        <!-- 结束按钮只在「全答完了」时才亮 —— 没答完就结束会白瞎这场面试 -->
        <el-button
          v-if="stage === 'answering'"
          type="primary"
          :icon="Check"
          :disabled="!allAnswered || finishTask.running.value"
          :loading="finishTask.running.value"
          @click="onFinish"
        >
          {{
            finishTask.running.value ? `生成报告中 ${finishTask.elapsed.value}s` : '结束并生成报告'
          }}
        </el-button>
        <el-button text type="danger" :icon="Delete" @click="onRemove">删除</el-button>
      </div>
    </header>

    <!-- 慢接口的等待提示。三个接口共用一套文案，但秒表是各自的 -->
    <div
      v-if="generateTask.running.value || answerTask.running.value || finishTask.running.value"
      class="waiting"
    >
      <span class="waiting__spinner" />
      <div>
        <p class="waiting__title">
          {{
            generateTask.running.value
              ? `正在出题，已经等了 ${generateTask.elapsed.value} 秒`
              : answerTask.running.value
                ? `正在评分，已经等了 ${answerTask.elapsed.value} 秒`
                : `正在生成报告，已经等了 ${finishTask.elapsed.value} 秒`
          }}
        </p>
        <p class="waiting__sub">AI 要现跑，通常几十秒到两分钟，请别关页面。</p>
      </div>
    </div>

    <!-- ---------- 加载失败 ---------- -->
    <section v-if="stage === 'failed'" class="pane pane--center">
      <h2 class="pane__title">加载不出来</h2>
      <p class="pane__text">这场面试可能已经被删掉了，或者网络有问题。</p>
      <div class="pane__actions">
        <el-button type="primary" @click="load">重试</el-button>
        <el-button @click="router.push({ name: 'interviews' })">回列表</el-button>
      </div>
    </section>

    <!-- ---------- ① 还没出题 ---------- -->
    <section v-else-if="stage === 'empty'" class="pane pane--center">
      <h2 class="pane__title">还没出题</h2>

      <!--
        ⚠️ 防御：创建时如果简历和职位都没给，出题接口会直接报错
        （Python 服务：「简历和 JD 至少要提供一个」）。
        新建的面试已经在弹窗里挡住了，但老数据可能两个都空 ——
        与其让用户点了看一个红框，不如现在就说清楚。
      -->
      <template v-if="!detail?.resumeId && !detail?.jobId">
        <p class="pane__text">
          这场面试创建时没有关联简历和职位，AI 没法出和你相关的题 ——
          请回列表重新建一场，至少选一个。
        </p>
        <el-button type="primary" @click="router.push({ name: 'interviews' })">
          回列表重新创建
        </el-button>
      </template>

      <template v-else>
        <p class="pane__text">点下面的按钮让 AI 按你的简历和目标岗位出题。这一步要等一会儿。</p>
        <el-button
          type="primary"
          :icon="MagicStick"
          :loading="generateTask.running.value"
          :disabled="generateTask.running.value"
          @click="onGenerate"
        >
          生成题目
        </el-button>
      </template>
    </section>

    <!-- ---------- ② 出好题了，还没开始 ---------- -->
    <section v-else-if="stage === 'ready'" class="pane">
      <h2 class="pane__title">题目已就绪（{{ questions.length }} 道）</h2>
      <p class="pane__text">
        开始后逐题作答，每题提交后立刻能看到点评和得分。中途可以退出，回来接着答。
      </p>

      <ol class="preview">
        <li v-for="q in questions" :key="q.id">
          <span class="preview__no">{{ q.questionNo }}</span>
          <span class="preview__q">{{ q.question }}</span>
          <span class="preview__type">{{ QT_TEXT[q.questionType ?? ''] ?? q.questionType }}</span>
        </li>
      </ol>

      <div class="pane__actions">
        <el-button type="primary" :icon="VideoPlay" @click="onStart">开始作答</el-button>
        <!-- 出题是幂等的，不满意可以重出 —— 但要说清会覆盖 -->
        <el-button
          :icon="MagicStick"
          :loading="generateTask.running.value"
          :disabled="generateTask.running.value"
          @click="onGenerate"
        >
          重新出题
        </el-button>
      </div>
      <p class="pane__note">重新出题会覆盖现有的 {{ questions.length }} 道题。</p>
    </section>

    <!-- ---------- ③ 作答中 ---------- -->
    <div v-else-if="stage === 'answering'" class="room">
      <!-- 题号导航 -->
      <nav class="nav">
        <button
          v-for="(q, i) in questions"
          :key="q.id"
          type="button"
          class="nav__item"
          :class="{
            'nav__item--on': i === cursor,
            'nav__item--done': q.answered,
          }"
          :title="
            q.answered
              ? `第 ${q.questionNo} 题（已答 ${q.score ?? '-'} 分）`
              : `第 ${q.questionNo} 题`
          "
          @click="goTo(i)"
        >
          {{ q.questionNo }}
        </button>
      </nav>

      <!-- 题目 + 作答 -->
      <section class="pane">
        <div class="q__head">
          <span class="q__no">第 {{ current?.questionNo }} 题</span>
          <span v-if="current?.questionType" class="q__badge">
            {{ QT_TEXT[current.questionType] ?? current.questionType }}
          </span>
          <span v-if="current?.difficulty" class="q__badge q__badge--dim">
            {{ DIFF_TEXT[current.difficulty] ?? current.difficulty }}
          </span>
        </div>

        <p class="q__text">{{ current?.question }}</p>

        <!-- 已答：显示自己的回答 + 点评 -->
        <template v-if="current?.answered">
          <div class="block">
            <h3 class="block__label">你的回答</h3>
            <p class="block__text">{{ current.userAnswer || '（空）' }}</p>
          </div>

          <div class="block">
            <h3 class="block__label">
              点评
              <span v-if="current.score !== null" class="score">{{ current.score }} 分</span>
            </h3>
            <InterviewAnalysisView :analysis="current.aiAnalysis" />
          </div>

          <!-- 参考答案要点只在答完之后给 —— 答之前给等于送答案 -->
          <div v-if="current.expectedPoints.length" class="block">
            <h3 class="block__label">参考要点</h3>
            <ul class="points">
              <li v-for="(p, i) in current.expectedPoints" :key="i">{{ p }}</li>
            </ul>
          </div>

          <el-button
            v-if="cursor < questions.length - 1"
            type="primary"
            :icon="Promotion"
            @click="onNext"
          >
            下一题
          </el-button>
        </template>

        <!-- 未答：输入框 -->
        <template v-else>
          <h3 class="block__label">你的回答</h3>
          <el-input
            v-model="answerText"
            type="textarea"
            :rows="10"
            placeholder="尽量写具体：用了什么方案、遇到什么问题、结果如何。答得越具体，点评越有用。"
          />
          <div class="pane__actions">
            <el-button
              type="primary"
              :icon="Promotion"
              :loading="answerTask.running.value"
              :disabled="answerTask.running.value"
              @click="onSubmitAnswer"
            >
              提交答案
            </el-button>
          </div>
        </template>
      </section>
    </div>

    <!-- ---------- ④ 报告 ---------- -->
    <div v-else-if="stage === 'report'" class="report">
      <template v-if="report">
        <section class="pane">
          <h2 class="pane__title">总评</h2>
          <div class="scores">
            <div class="scores__main">
              <span class="scores__value">{{ report.overallScore ?? '-' }}</span>
              <span class="scores__label">总分</span>
            </div>
            <div class="scores__sub">
              <div class="scores__item">
                <span class="scores__n">{{ report.technicalScore ?? '-' }}</span>
                <span class="scores__t">技术</span>
              </div>
              <div class="scores__item">
                <span class="scores__n">{{ report.communicationScore ?? '-' }}</span>
                <span class="scores__t">表达</span>
              </div>
              <div class="scores__item">
                <span class="scores__n">{{ report.problemSolvingScore ?? '-' }}</span>
                <span class="scores__t">解题</span>
              </div>
            </div>
          </div>

          <p v-if="report.reportText" class="report__text">{{ report.reportText }}</p>
          <p class="report__time">生成于 {{ formatDateTime(report.createdAt) }}</p>
        </section>

        <div class="cols">
          <section class="pane">
            <h2 class="pane__title">做得好的</h2>
            <ul class="points points--ok">
              <li v-for="(s, i) in report.strengths" :key="i">{{ s }}</li>
            </ul>
            <el-empty v-if="!report.strengths.length" :image-size="60" description="（无）" />
          </section>

          <section class="pane">
            <h2 class="pane__title">需要改进的</h2>
            <ul class="points points--warn">
              <li v-for="(w, i) in report.weaknesses" :key="i">{{ w }}</li>
            </ul>
            <el-empty v-if="!report.weaknesses.length" :image-size="60" description="（无）" />
          </section>
        </div>

        <section class="pane">
          <h2 class="pane__title">下一步怎么练</h2>
          <ul class="points">
            <li v-for="(s, i) in report.suggestions" :key="i">{{ s }}</li>
          </ul>
          <el-empty v-if="!report.suggestions.length" :image-size="60" description="（无）" />
        </section>

        <!-- 逐题回顾：报告是总览，细节还在每题里 -->
        <section class="pane">
          <h2 class="pane__title">逐题回顾</h2>
          <div v-for="(q, i) in questions" :key="q.id" class="review">
            <div class="review__head">
              <span class="q__no">第 {{ q.questionNo }} 题</span>
              <span v-if="q.score !== null" class="score">{{ q.score }} 分</span>
            </div>
            <p class="q__text q__text--sm">{{ q.question }}</p>
            <p class="block__text block__text--sm">{{ q.userAnswer || '（没答）' }}</p>
            <InterviewAnalysisView v-if="q.aiAnalysis" :analysis="q.aiAnalysis" compact />
            <el-divider v-if="i < questions.length - 1" />
          </div>
        </section>
      </template>

      <!-- 状态是 FINISHED 但报告拉不到（生成失败）—— 给个重试入口 -->
      <section v-else class="pane pane--center">
        <h2 class="pane__title">报告还没生成好</h2>
        <p class="pane__text">可以重新生成一次。</p>
        <el-button
          type="primary"
          :loading="finishTask.running.value"
          :disabled="finishTask.running.value"
          @click="onFinish"
        >
          生成报告
        </el-button>
      </section>
    </div>
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
  gap: var(--mf-space-2);
  align-items: center;
}

/* ---------- 等待 ---------- */
.waiting {
  display: flex;
  gap: var(--mf-space-4);
  align-items: center;
  padding: var(--mf-space-5);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-md);
}

.waiting__spinner {
  flex: none;
  width: 22px;
  height: 22px;
  border: 2px solid var(--mf-border-strong);
  border-top-color: var(--mf-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .waiting__spinner {
    animation: none;
  }
}

.waiting__title {
  margin: 0 0 2px;
  font-size: var(--mf-font-sm);
  font-weight: var(--mf-weight-medium);
}

.waiting__sub {
  margin: 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

/* ---------- 通用面板 ---------- */
.pane {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-4);
  padding: var(--mf-space-5);
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
}

.pane--center {
  align-items: center;
  padding: var(--mf-space-8);
  text-align: center;
}

.pane__title {
  margin: 0;
  font-size: var(--mf-font-md);
  font-weight: var(--mf-weight-medium);
}

.pane__text {
  margin: 0;
  font-size: var(--mf-font-sm);
  line-height: 1.7;
  color: var(--mf-text-secondary);
}

.pane__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-3);
}

.pane__note {
  margin: 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

/* ---------- 题目预览 ---------- */
.preview {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.preview li {
  display: flex;
  gap: var(--mf-space-3);
  align-items: baseline;
  padding: var(--mf-space-2) 0;
  border-bottom: 1px solid var(--mf-glass-border-soft);
}

.preview li:last-child {
  border-bottom: none;
}

.preview__no {
  flex: none;
  width: 20px;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.preview__q {
  flex: 1;
  font-size: var(--mf-font-sm);
  line-height: 1.6;
  color: var(--mf-text-secondary);
}

.preview__type {
  flex: none;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

/* ---------- 作答 ---------- */
.room {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-4);
}

.nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-2);
}

.nav__item {
  width: 32px;
  height: 32px;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-secondary);
  cursor: pointer;
  background-color: var(--mf-glass-tint);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-md);
  transition:
    background-color var(--mf-duration-fast) var(--mf-ease-out),
    color var(--mf-duration-fast) var(--mf-ease-out);
}

.nav__item:hover {
  color: var(--mf-text-primary);
  background-color: var(--mf-glass-tint-strong);
}

/* 已答的给个实底 —— 一眼看出还剩哪几题 */
.nav__item--done {
  color: var(--mf-success-text);
  background-color: var(--mf-success-subtle);
}

.nav__item--on {
  color: var(--mf-text-primary);
  background-color: var(--mf-primary-subtle);
  border-color: var(--mf-primary);
}

.nav__item:focus-visible {
  outline: 2px solid var(--mf-primary);
  outline-offset: 2px;
}

.q__head {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
}

.q__no {
  font-size: var(--mf-font-xs);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-primary-text);
}

.q__badge {
  padding: 0 var(--mf-space-2);
  font-size: var(--mf-font-xs);
  color: var(--mf-primary-text);
  background-color: var(--mf-primary-subtle);
  border-radius: var(--mf-radius-pill);
}

.q__badge--dim {
  color: var(--mf-text-tertiary);
  background-color: var(--mf-bg-subtle);
}

.q__text {
  margin: 0;
  font-size: var(--mf-font-md);
  font-weight: var(--mf-weight-medium);
  line-height: 1.7;
}

.q__text--sm {
  font-size: var(--mf-font-sm);
  font-weight: 400;
}

.block {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-2);
}

.block__label {
  display: flex;
  gap: var(--mf-space-2);
  align-items: baseline;
  margin: 0;
  font-size: var(--mf-font-xs);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-tertiary);
  letter-spacing: 0.04em;
}

.block__text {
  margin: 0;
  font-size: var(--mf-font-sm);
  line-height: 1.7;
  color: var(--mf-text-secondary);
  white-space: pre-wrap;
}

.block__text--sm {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.score {
  padding: 0 var(--mf-space-2);
  font-size: var(--mf-font-xs);
  color: var(--mf-primary-text);
  background-color: var(--mf-primary-subtle);
  border-radius: var(--mf-radius-pill);
}

.sub__label {
  margin: var(--mf-space-3) 0 var(--mf-space-1);
  font-size: var(--mf-font-xs);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-secondary);
}

.points {
  margin: 0;
  padding-left: 1.2em;
  font-size: var(--mf-font-sm);
  line-height: 1.8;
  color: var(--mf-text-secondary);
}

.points--ok li::marker {
  color: var(--mf-success);
}

.points--warn li::marker {
  color: var(--mf-warning);
}

/* ---------- 报告 ---------- */
.report {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-4);
}

.scores {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-6);
  align-items: center;
}

.scores__main {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.scores__value {
  font-size: 44px;
  font-weight: var(--mf-weight-medium);
  line-height: 1.1;
  color: var(--mf-primary-text);
  letter-spacing: -0.03em;
}

.scores__label {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.scores__sub {
  display: flex;
  gap: var(--mf-space-5);
}

.scores__item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.scores__n {
  font-size: var(--mf-font-lg);
  font-weight: var(--mf-weight-medium);
}

.scores__t {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.report__text {
  margin: 0;
  font-size: var(--mf-font-sm);
  line-height: 1.8;
  color: var(--mf-text-secondary);
  white-space: pre-wrap;
}

.report__time {
  margin: 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--mf-space-4);
}

@media (width <= 800px) {
  .cols {
    grid-template-columns: 1fr;
  }
}

.review {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-2);
}

.review__head {
  display: flex;
  gap: var(--mf-space-3);
  align-items: center;
}
</style>
