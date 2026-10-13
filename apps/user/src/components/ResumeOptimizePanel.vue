<script setup lang="ts">
import { MagicStick, CopyDocument, Warning } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'

import {
  BizError,
  type OptimizeTarget,
  type ResumeOptimizeItem,
  type ResumeOptimizeVO,
} from '@mindforge/shared'

import { resumeApi } from '@/api/resume'
import { useSlowTask } from '@/composables/useSlowTask'

const props = defineProps<{
  resumeId: string
  /** 简历没解析过时置灰 —— 后端会返回 40001「请先解析再优化」 */
  disabled: boolean
}>()

const result = ref<ResumeOptimizeVO | null>(null)

/**
 * 慢接口的「运行中 + 秒表」。
 * ⚠️ 这个接口要 100 秒以上，不给计时器用户会以为卡死了 ——
 *    逻辑抽在 composables/useSlowTask.ts（面试间那边也用同一份）。
 */
const { running, elapsed, run: runTask } = useSlowTask()

const TARGETS: { value: OptimizeTarget | ''; label: string }[] = [
  { value: '', label: '整体' },
  { value: 'SUMMARY', label: '个人总结' },
  { value: 'WORK_EXPERIENCE', label: '工作经历' },
  { value: 'PROJECT_EXPERIENCE', label: '项目经历' },
  { value: 'SKILLS', label: '技能' },
  { value: 'EDUCATION', label: '教育经历' },
]

const TARGET_LABEL: Record<string, string> = Object.fromEntries(
  TARGETS.filter((t) => t.value).map((t) => [t.value, t.label]),
)

const target = ref<OptimizeTarget | ''>('')

// ---------- ★ 两类建议必须分开 ----------
/**
 * ⚠️⚠️ 这是整个页面最不能做错的一处。
 *
 * `needsFact = false` → 「改写建议」：事实没变，只是换了个说法，`rewritten` 可以直接用。
 * `needsFact = true`  → 「待补事实」：**没有 `rewritten`**，AI 不肯替你编，
 *                       只用 `missingFact` 告诉你缺什么。
 *
 * 混在一起展示，用户会以为 AI 已经替他把经历写好了 ——
 * 而编造的经历在面试里被追问两句就露馅，**比不改还糟**。
 */
const rewrites = computed<ResumeOptimizeItem[]>(
  () => result.value?.items.filter((i) => !i.needsFact) ?? [],
)
const needFacts = computed<ResumeOptimizeItem[]>(
  () => result.value?.items.filter((i) => i.needsFact) ?? [],
)

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

async function run(): Promise<void> {
  const res = await runTask(() =>
    resumeApi.optimize(props.resumeId, { target: target.value || undefined }),
  ).catch((e) => {
    fail(e, 'AI 优化失败，请稍后重试')
    return undefined
  })
  if (!res) return

  result.value = res
  if (res.truncated) {
    ElMessage.warning('简历较长，这次只分析了前面一段')
  }
}

/** 复制改写后的句子 —— 后端没有「应用建议」的接口，用户自己粘回去 */
async function copy(text: string | null): Promise<void> {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    // 非 HTTPS 或没给剪贴板权限时会走到这里
    ElMessage.warning('复制失败，请手动选中文本')
  }
}
</script>

<template>
  <section class="opt">
    <header class="opt__head">
      <div>
        <h2 class="opt__title">
          AI 优化建议
          <span v-if="result?.needsFactCount" class="opt__badge">
            有 {{ result.needsFactCount }} 处需要你补充事实
          </span>
        </h2>
        <p class="opt__sub">
          已接入 🌐 全站官方智库行业标杆参考。只给建议，不会改你的简历，满意的那条自己复制回去改。
        </p>
      </div>

      <div class="opt__actions">
        <el-select v-model="target" class="opt__select" :disabled="running">
          <el-option v-for="t in TARGETS" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
        <el-button
          type="primary"
          :icon="MagicStick"
          :loading="running"
          :disabled="disabled || running"
          @click="run"
        >
          {{ running ? '分析中' : result ? '重新分析' : '开始分析' }}
        </el-button>
      </div>
    </header>

    <!-- 前置条件不满足时说清原因，别只把按钮置灰 -->
    <el-alert
      v-if="disabled"
      type="info"
      :closable="false"
      show-icon
      title="需要先解析简历"
      description="AI 优化要基于结构化后的内容做，先点上面的「解析」。"
    />

    <!-- 100 秒的接口，必须让用户知道它在动 -->
    <div v-else-if="running" class="waiting">
      <span class="waiting__spinner" />
      <div>
        <p class="waiting__title">正在分析，已经等了 {{ elapsed }} 秒</p>
        <p class="waiting__sub">
          这个接口要跑 1~2 分钟（要读完整份简历再逐条给建议），请别关页面。
        </p>
      </div>
    </div>

    <template v-else-if="result">
      <!-- 总评 -->
      <div class="overall">
        <p v-if="result.summary" class="overall__text">{{ result.summary }}</p>
        <!-- ⚠️ 评分只是参考 —— 后端也这么说。真正该看的是下面的 items，
             所以字号压小、颜色压淡，别让它抢戏 -->
        <span v-if="result.overallScore !== null" class="overall__score">
          参考分 {{ result.overallScore }}
        </span>
      </div>

      <!-- 亮点 -->
      <div v-if="result.highlights.length" class="block">
        <h3 class="block__label">已经写得不错的地方</h3>
        <ul class="list">
          <li v-for="(h, i) in result.highlights" :key="i">{{ h }}</li>
        </ul>
      </div>

      <!-- ★★ 第一组：改写建议（事实没变，可以直接用） -->
      <div v-if="rewrites.length" class="block">
        <h3 class="block__label block__label--ok">
          改写建议
          <span class="block__count">{{ rewrites.length }}</span>
        </h3>
        <p class="block__note">事实没变，只是换个说法。可以直接复制替换。</p>

        <article v-for="(it, i) in rewrites" :key="i" class="item">
          <span class="item__where">{{ TARGET_LABEL[it.target ?? ''] ?? '整体' }}</span>

          <div v-if="it.original" class="item__field">
            <span class="item__key">原句</span>
            <p class="item__val item__val--old">{{ it.original }}</p>
          </div>

          <div v-if="it.issue" class="item__field">
            <span class="item__key">问题</span>
            <p class="item__val">{{ it.issue }}</p>
          </div>

          <div v-if="it.rewritten" class="item__field">
            <span class="item__key">改成</span>
            <p class="item__val item__val--new">{{ it.rewritten }}</p>
            <el-button
              class="item__copy"
              size="small"
              text
              type="primary"
              :icon="CopyDocument"
              @click="copy(it.rewritten)"
            >
              复制
            </el-button>
          </div>

          <p v-if="it.suggestion" class="item__tip">{{ it.suggestion }}</p>
        </article>
      </div>

      <!-- ★★ 第二组：待补事实（AI 不肯编，要用户自己填） -->
      <div v-if="needFacts.length" class="block">
        <h3 class="block__label block__label--warn">
          <el-icon><Warning /></el-icon>
          待补事实
          <span class="block__count">{{ needFacts.length }}</span>
        </h3>
        <p class="block__note">
          这些地方 AI <strong>不会替你写</strong> —— 缺的是真实数据，编出来在面试里一追问就露馅。
          请你把实际情况补上，再自己润色。
        </p>

        <article v-for="(it, i) in needFacts" :key="i" class="item item--warn">
          <span class="item__where">{{ TARGET_LABEL[it.target ?? ''] ?? '整体' }}</span>

          <div v-if="it.original" class="item__field">
            <span class="item__key">原句</span>
            <p class="item__val item__val--old">{{ it.original }}</p>
          </div>

          <div v-if="it.issue" class="item__field">
            <span class="item__key">问题</span>
            <p class="item__val">{{ it.issue }}</p>
          </div>

          <div v-if="it.missingFact" class="item__field">
            <span class="item__key">缺什么</span>
            <p class="item__val item__val--missing">{{ it.missingFact }}</p>
          </div>

          <p v-if="it.suggestion" class="item__tip">{{ it.suggestion }}</p>
        </article>
      </div>
    </template>

    <el-empty v-else :image-size="70" description="点「开始分析」，让 AI 逐条给你建议" />
  </section>
</template>

<style scoped>
.opt {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-4);
  padding: var(--mf-space-5);
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
}

.opt__head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-4);
  align-items: flex-start;
  justify-content: space-between;
}

.opt__title {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-3);
  align-items: center;
  margin: 0 0 var(--mf-space-1);
  font-size: var(--mf-font-lg);
  font-weight: var(--mf-weight-medium);
}

/* 「有 N 处要补」是用户最该先看到的信息，给个醒目的标签 */
.opt__badge {
  padding: 2px var(--mf-space-3);
  font-size: var(--mf-font-xs);
  font-weight: 400;
  color: var(--mf-warning-text);
  background-color: var(--mf-warning-subtle);
  border-radius: var(--mf-radius-pill);
}

.opt__sub {
  margin: 0;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
}

.opt__actions {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
}

.opt__select {
  width: 130px;
}

/* ---------- 等待中 ---------- */
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

/* 系统设了「减少动态效果」就别转圈了 —— 文字里的秒数仍然在变，够表达「在跑」 */
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

/* ---------- 总评 ---------- */
.overall {
  display: flex;
  gap: var(--mf-space-4);
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--mf-space-4);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-md);
}

.overall__text {
  margin: 0;
  font-size: var(--mf-font-sm);
  line-height: 1.7;
  color: var(--mf-text-secondary);
}

.overall__score {
  flex: none;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

/* ---------- 分组 ---------- */
.block {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3);
}

.block__label {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
  margin: 0;
  font-size: var(--mf-font-sm);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-secondary);
}

.block__label--ok {
  color: var(--mf-success-text);
}

.block__label--warn {
  color: var(--mf-warning-text);
}

.block__count {
  padding: 0 var(--mf-space-2);
  font-size: var(--mf-font-xs);
  font-weight: 400;
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-pill);
}

.block__note {
  margin: calc(-1 * var(--mf-space-2)) 0 0;
  font-size: var(--mf-font-xs);
  line-height: 1.6;
  color: var(--mf-text-tertiary);
}

.list {
  margin: 0;
  padding-left: 1.2em;
  font-size: var(--mf-font-sm);
  line-height: 1.8;
  color: var(--mf-text-secondary);
}

/* ---------- 单条建议 ---------- */
.item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-2);
  padding: var(--mf-space-4);
  background-color: var(--mf-bg-surface);
  border: 1px solid var(--mf-glass-border-soft);
  border-left: 3px solid var(--mf-success);
  border-radius: var(--mf-radius-md);
}

/* 「待补事实」用警告色 + 虚线左边框 —— 和「改写建议」在视觉上必须一眼分得开 */
.item--warn {
  background-color: var(--mf-warning-subtle);
  border-left: 3px dashed var(--mf-warning);
}

.item__where {
  align-self: flex-start;
  padding: 0 var(--mf-space-2);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-pill);
}

.item__field {
  display: flex;
  gap: var(--mf-space-3);
  align-items: baseline;
}

.item__key {
  flex: none;
  width: 42px;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.item__val {
  margin: 0;
  font-size: var(--mf-font-sm);
  line-height: 1.7;
  color: var(--mf-text-secondary);
}

.item__val--old {
  color: var(--mf-text-tertiary);
  text-decoration: line-through;
  text-decoration-color: var(--mf-border-strong);
}

.item__val--new {
  color: var(--mf-text-primary);
  font-weight: var(--mf-weight-medium);
}

.item__val--missing {
  color: var(--mf-warning-text);
  font-weight: var(--mf-weight-medium);
}

.item__copy {
  align-self: flex-start;
  margin-left: 54px;
}

.item__tip {
  margin: 0;
  padding-top: var(--mf-space-2);
  font-size: var(--mf-font-xs);
  line-height: 1.6;
  color: var(--mf-text-tertiary);
  border-top: 1px solid var(--mf-glass-border-soft);
}
</style>
