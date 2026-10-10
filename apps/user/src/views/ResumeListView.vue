<script setup lang="ts">
import { DocumentAdd, MagicStick, Refresh, Delete, Document } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { BizError, formatBytes, formatDateTime, type ResumeVO } from '@mindforge/shared'

import { resumeApi } from '@/api/resume'
import { useAutoRefresh } from '@/composables/useAutoRefresh'

const router = useRouter()

const loading = ref(false)
const rows = ref<ResumeVO[]>([])
const total = ref(0)
const query = reactive({ page: 1, pageSize: 12 })

/** 正在上传 / 正在触发解析的简历 id（按钮 loading 用） */
const uploading = ref(false)
const acting = ref<string | null>(null)
const fileInput = ref<HTMLInputElement>()

/**
 * 允许的扩展名 —— 和 Java `UploadConstants.RESUME_EXT` 逐字对齐。
 * ⚠️ 前端挡一道只是为了**给个清楚的提示**，不是安全边界（后端才是）。
 *    不一致的话会出现「前端拦下了但后端其实支持」这种莫名其妙的情况。
 */
const ACCEPT = '.pdf,.docx,.txt,.md,.markdown,.html,.htm'

const STATUS_TEXT: Record<string, string> = {
  PENDING: '待解析',
  PARSING: '解析中',
  SUCCESS: '已解析',
  FAILED: '解析失败',
}

const STATUS_TONE: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  PENDING: 'neutral',
  PARSING: 'warning',
  SUCCESS: 'success',
  FAILED: 'danger',
}

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

async function load(options: { silent?: boolean } = {}): Promise<void> {
  const { silent = false } = options
  if (!silent) loading.value = true
  try {
    const data = await resumeApi.page({ page: query.page, pageSize: query.pageSize })
    rows.value = data.records
    total.value = data.total
  } catch (e) {
    // 静默轮询失败不弹提示 —— 网络抖一下就弹红框太吵，下一轮自己会重试
    if (!silent) fail(e, '加载失败')
  } finally {
    if (!silent) loading.value = false
  }
}

/**
 * 有简历正在解析中就自动刷新 —— 解析是后端异步跑的，光靠手动点根本不知道什么时候好。
 * 逻辑在 composables/useAutoRefresh.ts（和管理端文档列表共用同一套）。
 */
const {
  active: refreshing,
  exhausted,
  resume,
} = useAutoRefresh({
  shouldContinue: () => rows.value.some((r) => r.parseStatus === 'PARSING'),
  onRefresh: () => load({ silent: true }),
})

// ---------- 上传 ----------
function pickFile(): void {
  fileInput.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // ⚠️ 先清空 input 的值：不清的话「选同一个文件第二次」不会触发 change 事件
  //    （浏览器认为值没变），用户会以为按钮坏了。
  input.value = ''
  if (!file) return

  uploading.value = true
  try {
    const created = await resumeApi.upload(file)
    ElMessage.success('上传成功，接着点「解析」让 AI 读出内容')
    await load()
    // 上传完不自动解析 —— 后端刻意把两件事拆开（解析是几十秒的慢接口），
    // 而且让用户显式点一下，他对「要等一会儿」有预期。
    void created
  } catch (e) {
    fail(e, '上传失败')
  } finally {
    uploading.value = false
  }
}

// ---------- 操作 ----------
async function onParse(row: ResumeVO): Promise<void> {
  acting.value = row.id
  try {
    await resumeApi.parse(row.id)
    ElMessage.success('已提交解析，稍等片刻')
    await load()
  } catch (e) {
    fail(e, '提交解析失败')
  } finally {
    acting.value = null
  }
}

async function onOptimize(row: ResumeVO): Promise<void> {
  // 跳详情页去优化 —— 优化是 100 秒的慢接口，不适合在列表里等
  await router.push({ name: 'resume-detail', params: { id: row.id } })
}

async function onRemove(row: ResumeVO): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除简历「${row.name}」？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return // 用户取消
  }

  try {
    await resumeApi.remove(row.id)
    ElMessage.success('已删除')
    // 删的是本页最后一条时要回退一页，否则会停在空页上
    if (rows.value.length === 1 && query.page > 1) query.page -= 1
    await load()
  } catch (e) {
    fail(e, '删除失败')
  }
}

const empty = computed(() => !loading.value && rows.value.length === 0)

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">我的简历</h1>
        <p class="page__sub">上传后点「解析」，AI 会读出你的经历、技能和项目</p>
      </div>

      <div class="page__actions">
        <!--
          自动刷新指示。只在有简历解析中时才亮 —— 没在解析的时候刷也是白刷。
          复用和管理端文档列表同一套逻辑（composables/useAutoRefresh.ts）。
        -->
        <span v-if="refreshing || exhausted" class="refresh">
          <span class="refresh__dot" :class="{ 'refresh__dot--on': refreshing }" />
          <span class="refresh__text">{{ exhausted ? '自动刷新已暂停' : '解析中，自动刷新' }}</span>
          <el-button v-if="exhausted" link type="primary" @click="resume">继续</el-button>
        </span>

        <!--
          用原生 input[type=file] 而不是 el-upload：
          el-upload 的样式和交互对「单个文件、选完就传」这个场景是过度的，
          而且它要额外拉一批组件 chunk。原生 input 完全够用，行为也更可预期。
        -->
        <input
          ref="fileInput"
          type="file"
          :accept="ACCEPT"
          class="page__file"
          @change="onFileChange"
        />
        <el-button type="primary" :icon="DocumentAdd" :loading="uploading" @click="pickFile">
          上传简历
        </el-button>
      </div>
    </header>

    <div v-loading="loading" class="grid">
      <article v-for="r in rows" :key="r.id" class="card">
        <div class="card__head">
          <el-icon class="card__icon"><Document /></el-icon>
          <div class="card__main">
            <button type="button" class="card__name" @click="onOptimize(r)">
              {{ r.name }}
            </button>
            <span class="card__meta">
              {{ r.targetPosition || '未填目标职位' }} · {{ formatBytes(r.fileSize) }}
            </span>
          </div>
          <span class="tag" :class="`tag--${STATUS_TONE[r.parseStatus]}`">
            {{ STATUS_TEXT[r.parseStatus] ?? r.parseStatus }}
          </span>
        </div>

        <p class="card__time">上传于 {{ formatDateTime(r.createdAt) }}</p>

        <div class="card__foot">
          <!--
            解析按钮的文案随状态变：
              没解析过 → 「解析」
              解析过   → 「重新解析」（改了文件想重跑）
              解析中   → 禁用（正在跑，再点没意义）
          -->
          <el-button
            v-if="r.parseStatus !== 'SUCCESS'"
            size="small"
            :icon="Refresh"
            :loading="acting === r.id"
            :disabled="r.parseStatus === 'PARSING'"
            @click="onParse(r)"
          >
            {{ r.parseStatus === 'FAILED' ? '重试解析' : '解析' }}
          </el-button>
          <el-button v-else size="small" :icon="Refresh" @click="onParse(r)">重新解析</el-button>

          <el-button
            size="small"
            type="primary"
            :icon="MagicStick"
            :disabled="r.parseStatus !== 'SUCCESS'"
            :title="r.parseStatus !== 'SUCCESS' ? '要先解析才能做 AI 优化' : ''"
            @click="onOptimize(r)"
          >
            AI 优化
          </el-button>

          <el-button size="small" text type="danger" :icon="Delete" @click="onRemove(r)">
            删除
          </el-button>
        </div>
      </article>
    </div>

    <el-empty v-if="empty" description="还没有简历，点右上角上传一份">
      <el-button type="primary" :icon="DocumentAdd" @click="pickFile">上传简历</el-button>
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

/* 原生文件选择器藏起来 —— 点击由「上传简历」按钮转发 */
.page__file {
  display: none;
}

/* ---------- 自动刷新指示 ---------- */
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

/* 名字做成按钮而不是链接：它触发的是跳转，但语义上是「打开这一份」，
   而且用 button 能天然拿到键盘可达性 */
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

.card__time {
  margin: 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
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

.tag--danger {
  color: var(--mf-danger-text);
  background-color: var(--mf-danger-subtle);
}

.page__pager {
  justify-content: flex-end;
}
</style>
