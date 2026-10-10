<script setup lang="ts">
import { Plus, MagicStick, Edit, Delete, Briefcase } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { BizError, formatDateTime, type JobVO } from '@mindforge/shared'

import { jobApi } from '@/api/job'
import JobFormDialog from '@/components/JobFormDialog.vue'

const router = useRouter()

const loading = ref(false)
const rows = ref<JobVO[]>([])
const total = ref(0)
const query = reactive({ page: 1, pageSize: 12, keyword: '' })

/** 正在解析的职位 id —— 解析是【同步接口】，可能要等几十秒 */
const parsing = ref<string | null>(null)

const formVisible = ref(false)
const formJob = ref<JobVO | null>(null)

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

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await jobApi.page({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined,
    })
    rows.value = data.records
    total.value = data.total
  } catch (e) {
    fail(e, '加载失败')
  } finally {
    loading.value = false
  }
}

function onSearch(): void {
  query.page = 1
  void load()
}

function onCreate(): void {
  formJob.value = null
  formVisible.value = true
}

function onEdit(row: JobVO): void {
  formJob.value = row
  formVisible.value = true
}

/**
 * 解析。
 *
 * ⚠️ 和简历那边不同 —— 职位的解析是**同步接口**：请求会一直挂到模型出结果
 *    （几十秒），然后直接把解析后的详情返回。所以这里不能用轮询，
 *    只能老老实实等，界面上要给个明确的「正在等」状态。
 */
async function onParse(row: JobVO): Promise<void> {
  parsing.value = row.id
  try {
    await jobApi.parse(row.id)
    ElMessage.success('解析完成')
    await load()
  } catch (e) {
    fail(e, '解析失败')
    // 失败时后端会把 parseStatus 置成 FAILED 并记下原因，刷新一下让用户看到
    await load()
  } finally {
    parsing.value = null
  }
}

async function onRemove(row: JobVO): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除职位「${row.title}」？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return // 用户取消
  }

  try {
    await jobApi.remove(row.id)
    ElMessage.success('已删除')
    // 删的是本页最后一条时要回退一页，否则会停在空页上
    if (rows.value.length === 1 && query.page > 1) query.page -= 1
    await load()
  } catch (e) {
    fail(e, '删除失败')
  }
}

function openDetail(row: JobVO): void {
  void router.push({ name: 'job-detail', params: { id: row.id } })
}

const empty = computed(() => !loading.value && rows.value.length === 0)

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">目标职位</h1>
        <p class="page__sub">把想投的 JD 粘进来，AI 会读出它真正看重什么</p>
      </div>

      <div class="page__actions">
        <el-input
          v-model="query.keyword"
          placeholder="搜职位或公司"
          clearable
          class="page__search"
          @keyup.enter="onSearch"
          @clear="onSearch"
        />
        <el-button type="primary" :icon="Plus" @click="onCreate">添加职位</el-button>
      </div>
    </header>

    <div v-loading="loading" class="grid">
      <article v-for="j in rows" :key="j.id" class="card">
        <div class="card__head">
          <el-icon class="card__icon"><Briefcase /></el-icon>
          <div class="card__main">
            <button type="button" class="card__name" @click="openDetail(j)">
              {{ j.title }}
            </button>
            <span class="card__meta">
              {{ [j.companyName, j.location].filter(Boolean).join(' · ') || '未填公司/地点' }}
            </span>
          </div>
          <span class="tag" :class="`tag--${STATUS_TONE[j.parseStatus]}`">
            {{ STATUS_TEXT[j.parseStatus] ?? j.parseStatus }}
          </span>
        </div>

        <p class="card__reqs">
          <span v-if="j.experienceRequired">{{ j.experienceRequired }}</span>
          <span v-if="j.educationRequired">{{ j.educationRequired }}</span>
          <span class="card__time">{{ formatDateTime(j.createdAt) }}</span>
        </p>

        <!-- 解析失败要把原因摆出来，别只留一个红标签 -->
        <p v-if="j.parseStatus === 'FAILED'" class="card__err">解析失败，点「重试解析」再试一次</p>

        <div class="card__foot">
          <el-button
            size="small"
            :icon="MagicStick"
            :loading="parsing === j.id"
            :disabled="parsing !== null"
            @click="onParse(j)"
          >
            {{ parsing === j.id ? '解析中' : j.parseStatus === 'SUCCESS' ? '重新解析' : '解析' }}
          </el-button>
          <el-button size="small" :icon="Edit" :disabled="parsing !== null" @click="onEdit(j)">
            编辑
          </el-button>
          <el-button
            size="small"
            text
            type="danger"
            :icon="Delete"
            :disabled="parsing !== null"
            @click="onRemove(j)"
          >
            删除
          </el-button>
        </div>
      </article>
    </div>

    <el-empty v-if="empty" description="还没有职位，点右上角添加一个">
      <el-button type="primary" :icon="Plus" @click="onCreate">添加职位</el-button>
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

    <JobFormDialog v-model="formVisible" :job="formJob" @saved="load" />
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

.page__search {
  width: 200px;
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

.card__reqs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-3);
  align-items: center;
  margin: 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.card__time {
  margin-left: auto;
  color: var(--mf-text-tertiary);
}

.card__err {
  margin: 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-danger-text);
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
