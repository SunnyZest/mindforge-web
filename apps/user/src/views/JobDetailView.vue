<script setup lang="ts">
import { MagicStick, Back, Edit, Link } from '@element-plus/icons-vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { BizError, formatDateTime, type JobDetailVO } from '@mindforge/shared'

import { jobApi } from '@/api/job'
import JobFormDialog from '@/components/JobFormDialog.vue'
import ResumeJobMatchPanel from '@/components/ResumeJobMatchPanel.vue'

const route = useRoute()
const router = useRouter()

const id = computed(() => String(route.params.id))
const loading = ref(false)
const parsing = ref(false)
const detail = ref<JobDetailVO | null>(null)

/** 结构化里被点中的值 —— 点它就在左边原文里高亮 */
const highlight = ref('')
const missNote = ref('')

const rawRef = ref<HTMLElement>()

/**
 * 编辑弹窗。
 * ★ 详情页也要能改 —— 看完 AI 解析出来的要求，往往就想顺手补一下 JD。
 *   让用户退回列表再点编辑是多余的。
 *   直接传 detail 就行：JobDetailVO 在结构上包含 JobVO 的所有字段。
 */
const formVisible = ref(false)

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

async function load(): Promise<void> {
  loading.value = true
  try {
    detail.value = await jobApi.detail(id.value)
  } catch (e) {
    fail(e, '加载失败')
  } finally {
    loading.value = false
  }
}

/**
 * 解析。
 * ⚠️ 职位解析是**同步接口** —— 请求会挂到模型出结果，可能要几十秒。
 *    返回的就是解析后的完整详情，不用再拉一次。
 */
async function onParse(): Promise<void> {
  parsing.value = true
  try {
    detail.value = await jobApi.parse(id.value)
    ElMessage.success('解析完成')
  } catch (e) {
    fail(e, '解析失败')
    // 失败时后端把 parseStatus 置成 FAILED 并记了原因，重新拉一次让用户看到
    await load()
  } finally {
    parsing.value = false
  }
}

// ---------- 对照 ----------
/**
 * 把原文按 `highlight` 切成三段。
 * ⚠️ 用 indexOf 不用正则 —— 技能名里可能有 `C++`、`(Java)` 这种带元字符的字符串。
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

async function locate(value: string | null | undefined): Promise<void> {
  if (!value) return
  highlight.value = value
  missNote.value = ''
  await nextTick()

  if (!rawParts.value.hit) {
    missNote.value = `「${value}」在原文里没找到 —— 可能是 AI 归纳过的说法，不是原句照抄。`
    return
  }
  rawRef.value?.querySelector('mark')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

// ---------- 技能分组 ----------
/**
 * ★ 按 `required` 把技能分成「硬性要求」和「加分项」。
 *
 * ⚠️ 后端定的默认值：JD 里**没写「必须」的一律算加分项**（false）。
 *    所以「加分项」这一组的准确含义是「没明确说是硬性的」，不是「明确说是可选的」——
 *    文案上要留这个余地，别写成「可选」让用户误判。
 */
const hardSkills = computed(
  () => detail.value?.structuredJson?.skills.filter((s) => s.required) ?? [],
)
const softSkills = computed(
  () => detail.value?.structuredJson?.skills.filter((s) => !s.required) ?? [],
)

const safeSourceUrl = computed(() => {
  const url = detail.value?.sourceUrl?.trim()
  return url && /^https?:\/\//i.test(url) ? url : null
})

watch(id, () => {
  highlight.value = ''
  missNote.value = ''
})

onMounted(load)
</script>

<template>
  <div v-loading="loading" class="page">
    <header class="head">
      <el-button text :icon="Back" @click="router.push({ name: 'jobs' })">返回列表</el-button>

      <div class="head__main">
        <h1 class="head__title">{{ detail?.title ?? '职位' }}</h1>
        <p class="head__meta">
          {{
            [detail?.companyName, detail?.location].filter(Boolean).join(' · ') || '未填公司/地点'
          }}
          <template v-if="detail?.experienceRequired"> · {{ detail.experienceRequired }}</template>
          <template v-if="detail?.educationRequired"> · {{ detail.educationRequired }}</template>
        </p>
      </div>

      <div class="head__actions">
        <el-button :icon="Edit" :disabled="!detail" @click="formVisible = true">编辑</el-button>
        <el-button :icon="MagicStick" :loading="parsing" :disabled="parsing" @click="onParse">
          {{ parsing ? '解析中' : detail?.parseStatus === 'SUCCESS' ? '重新解析' : '解析' }}
        </el-button>
      </div>
    </header>

    <el-alert
      v-if="detail?.parseStatus === 'FAILED'"
      type="error"
      :closable="false"
      show-icon
      title="解析失败"
      :description="detail.errorMessage || '原因未知，可以点「重试解析」再试一次'"
    />

    <div class="split">
      <!-- 左：JD 原文 -->
      <section class="pane">
        <h2 class="pane__title">
          JD 原文
          <a
            v-if="safeSourceUrl"
            class="pane__link"
            :href="safeSourceUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <el-icon><Link /></el-icon>原链接
          </a>
        </h2>
        <pre ref="rawRef" class="raw">{{ rawParts.before }}<mark
            v-if="rawParts.hit"
            class="raw__hit"
          >{{ rawParts.hit }}</mark>{{ rawParts.after }}</pre>
        <p v-if="missNote" class="pane__note">{{ missNote }}</p>
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
          description="点上面的「解析」，AI 会读出职责、技能和经验要求"
        />

        <div v-else class="s">
          <div v-if="detail.structuredJson.summary" class="s__block">
            <h3 class="s__label">这个岗位在找什么人</h3>
            <p class="s__text">{{ detail.structuredJson.summary }}</p>
          </div>

          <!-- 硬性要求 -->
          <div v-if="hardSkills.length" class="s__block">
            <h3 class="s__label s__label--hard">
              硬性要求
              <span class="s__count">{{ hardSkills.length }}</span>
            </h3>
            <div class="chips">
              <button
                v-for="sk in hardSkills"
                :key="sk.name"
                type="button"
                class="chip chip--hard"
                @click="locate(sk.name)"
              >
                {{ sk.name }}
                <span v-if="sk.requiredLevel" class="chip__extra">{{ sk.requiredLevel }}</span>
              </button>
            </div>
          </div>

          <!-- 加分项 -->
          <div v-if="softSkills.length" class="s__block">
            <h3 class="s__label">
              加分项
              <span class="s__count">{{ softSkills.length }}</span>
            </h3>
            <!-- ⚠️ 措辞留余地：后端的规则是「没写必须就算 false」，
                 所以这里是「没明确说是硬性的」，不等于「明确说了可选」 -->
            <p class="s__hint">JD 里没明确写「必须」的，都归到这里。</p>
            <div class="chips">
              <button
                v-for="sk in softSkills"
                :key="sk.name"
                type="button"
                class="chip"
                @click="locate(sk.name)"
              >
                {{ sk.name }}
                <span v-if="sk.requiredLevel" class="chip__extra">{{ sk.requiredLevel }}</span>
              </button>
            </div>
          </div>

          <!-- 岗位职责 -->
          <div v-if="detail.structuredJson.responsibilities.length" class="s__block">
            <h3 class="s__label">
              岗位职责
              <span class="s__count">{{ detail.structuredJson.responsibilities.length }}</span>
            </h3>
            <ul class="resp">
              <li v-for="(r, i) in detail.structuredJson.responsibilities" :key="i">
                <button type="button" class="resp__btn" @click="locate(r)">{{ r }}</button>
              </li>
            </ul>
          </div>

          <!-- 福利 -->
          <div v-if="detail.structuredJson.benefits.length" class="s__block">
            <h3 class="s__label">福利待遇</h3>
            <div class="chips">
              <button
                v-for="b in detail.structuredJson.benefits"
                :key="b"
                type="button"
                class="chip chip--plain"
                @click="locate(b)"
              >
                {{ b }}
              </button>
            </div>
          </div>

          <p class="s__time">最后更新 {{ formatDateTime(detail.updatedAt) }}</p>
        </div>
      </section>
    </div>

    <!-- ---------- 简历与岗位智能匹配分析 ---------- -->
    <ResumeJobMatchPanel
      :job-id="id"
      :job-title="detail?.title ?? ''"
      :job-parsed="detail?.parseStatus === 'SUCCESS'"
    />

    <!-- 编辑弹窗。传 detail 就行 —— JobDetailVO 结构上包含 JobVO 的全部字段。
         保存后重新拉一次，让左边的原文和右边的结构化都跟着更新。 -->
    <JobFormDialog v-model="formVisible" :job="detail" @saved="load" />
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

/* ---------- 左右对照 ---------- */
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--mf-space-5);
  align-items: start;
}

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
  gap: var(--mf-space-3);
  align-items: baseline;
  margin: 0;
  font-size: var(--mf-font-sm);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-secondary);
}

.pane__link {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-size: var(--mf-font-xs);
  font-weight: 400;
  color: var(--mf-primary-text);
  text-decoration: none;
}

.pane__link:hover {
  text-decoration: underline;
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

/* 硬性要求给个颜色 —— 这是用户最该先看的一组 */
.s__label--hard {
  color: var(--mf-danger-text);
}

.s__count {
  padding: 0 var(--mf-space-2);
  background-color: var(--mf-bg-subtle);
  border-radius: var(--mf-radius-pill);
}

.s__hint {
  margin: 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.s__text {
  margin: 0;
  font-size: var(--mf-font-sm);
  line-height: 1.7;
  color: var(--mf-text-secondary);
}

.s__time {
  margin: 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

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

/* 硬性要求用危险色 —— 和「加分项」的蓝色一眼分得开 */
.chip--hard {
  color: var(--mf-danger-text);
  background-color: var(--mf-danger-subtle);
}

.chip--plain {
  color: var(--mf-text-secondary);
  background-color: var(--mf-bg-subtle);
}

.chip__extra {
  color: var(--mf-text-tertiary);
}

/* ---------- 职责 ---------- */
.resp {
  margin: 0;
  padding: 0;
  list-style: none;
}

.resp li {
  display: flex;
  gap: var(--mf-space-2);
  padding: var(--mf-space-2) 0;
  border-bottom: 1px solid var(--mf-glass-border-soft);
}

.resp li:last-child {
  border-bottom: none;
}

.resp li::before {
  flex: none;
  color: var(--mf-text-tertiary);
  content: '·';
}

.resp__btn {
  padding: 0;
  font-size: var(--mf-font-sm);
  line-height: 1.7;
  color: var(--mf-text-secondary);
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;
}

.resp__btn:hover {
  color: var(--mf-primary-text);
}

.resp__btn:focus-visible {
  outline: 2px solid var(--mf-primary);
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
