<script setup lang="ts">
import { Plus, Trophy } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'

import { BizError, type OfferStatus, type OfferVO } from '@mindforge/shared'

import OfferCompareBoard from '@/components/OfferCompareBoard.vue'
import OfferFormDialog from '@/components/OfferFormDialog.vue'
import { offerApi } from '@/api/offer'

/**
 * Offer 对比（五维打分表）。
 *
 * 纯本地计算的功能：打分是用户自己的事，所以这里没有"AI 一键分析"，
 * 也没有 loading 转圈等待 —— 交互重点在「拖权重滑块 → 排名实时变」。
 */

/** 五个维度的短标签（表格里放不下长名，详细说明在对比区和表单里有） */
const SCORE_HEADS = [
  { key: 'salaryScore', label: '薪' },
  { key: 'techScore', label: '技' },
  { key: 'brandScore', label: '牌' },
  { key: 'wlbScore', label: '眠' },
  { key: 'commuteScore', label: '通' },
] as const

const STATUS_META: Record<OfferStatus, { label: string; type: 'warning' | 'success' | 'info' }> = {
  PENDING: { label: '考虑中', type: 'warning' },
  ACCEPTED: { label: '已接受', type: 'success' },
  DECLINED: { label: '已拒绝', type: 'info' },
}

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '' as OfferStatus | '',
})

const rows = ref<OfferVO[]>([])
const total = ref(0)
const loading = ref(false)

const selectedIds = ref<string[]>([])
const selectionLimit = 5

const formVisible = ref(false)
const editing = ref<OfferVO | null>(null)

const selectedCount = computed(() => selectedIds.value.length)
const canCompare = computed(() => selectedCount.value >= 2)

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await offerApi.page({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined,
      status: query.status || undefined,
    })
    rows.value = data.records
    total.value = data.total
  } catch (e) {
    fail(e, '加载失败')
  } finally {
    loading.value = false
  }
}

function search(): void {
  query.page = 1
  load()
}

/**
 * el-table 插槽的 `row` 是 `DefaultRow`（组件库的宽类型），直接传给
 * `(row: OfferVO) => void` 会类型不匹配。这里统一转一次，别在模板里散写断言
 * （散写的话将来改字段名会漏，全在这一个函数里改最稳）。
 */
function asOffer(row: unknown): OfferVO {
  return row as OfferVO
}

function onPageChange(page: number): void {
  query.page = page
  load()
}

/**
 * 多选变化。
 *
 * ⚠️ 后端一次最多对比 5 个，超出时**拦下来并撤销这次勾选** ——
 * 静默丢弃会让用户以为是 bug（明明勾了却没反应），静默保留则超限后必报错。
 */
function onSelectionChange(rows_: OfferVO[]): void {
  if (rows_.length > selectionLimit) {
    ElMessage.warning(`一次最多对比 ${selectionLimit} 个 Offer，请先取消一些`)
    return
  }
  selectedIds.value = rows_.map((r) => r.id)
}

function openCreate(): void {
  editing.value = null
  formVisible.value = true
}

function openEdit(row: OfferVO): void {
  editing.value = row
  formVisible.value = true
}

async function setStatus(row: OfferVO, status: OfferStatus): Promise<void> {
  try {
    await offerApi.updateStatus(row.id, { status })
    ElMessage.success('已更新')
    load()
  } catch (e) {
    fail(e, '更新失败')
  }
}

/** 删除是破坏性且不可恢复的操作 —— 按约定必须二次确认 */
async function remove(row: OfferVO): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除「${row.companyName}」的 Offer 吗？删除后不可恢复。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await offerApi.remove(row.id)
    ElMessage.success('已删除')
    if (selectedIds.value.includes(row.id)) {
      selectedIds.value = selectedIds.value.filter((id) => id !== row.id)
    }
    load()
  } catch (e) {
    fail(e, '删除失败')
  }
}

function onSaved(): void {
  load()
}

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h2 class="page__title">Offer 对比</h2>
        <p class="page__desc">
          拿到多家 Offer 后，按五个维度各打 1~10 分，再决定每个维度对你有多重要 ——
          剩下的加权排名交给它。不调用模型，随时改随时算。
        </p>
      </div>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>
        添加 Offer
      </el-button>
    </header>

    <el-card class="page__card" shadow="never">
      <div class="filters">
        <el-input
          v-model="query.keyword"
          placeholder="搜索公司 / 岗位"
          clearable
          style="width: 240px"
          @keyup.enter="search"
          @clear="search"
        />
        <el-select v-model="query.status" placeholder="状态" clearable style="width: 140px" @change="search">
          <el-option label="考虑中" value="PENDING" />
          <el-option label="已接受" value="ACCEPTED" />
          <el-option label="已拒绝" value="DECLINED" />
        </el-select>
        <el-button @click="search">查询</el-button>
        <span v-if="selectedCount" class="filters__hint">
          已选 {{ selectedCount }} / {{ selectionLimit }} 个用于对比
        </span>
      </div>

      <el-table
        :data="rows"
        v-loading="loading"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="42" />

        <el-table-column label="公司" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="cell__company">{{ row.companyName }}</span>
          </template>
        </el-table-column>

        <el-table-column label="岗位" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.positionName || '—' }}</template>
        </el-table-column>

        <el-table-column label="年薪" width="96" align="center">
          <template #default="{ row }">
            <span v-if="row.salaryAnnual != null">{{ row.salaryAnnual }} 万</span>
            <span v-else class="cell__muted">—</span>
          </template>
        </el-table-column>

        <el-table-column
          v-for="h in SCORE_HEADS"
          :key="h.key"
          :label="h.label"
          width="48"
          align="center"
        >
          <template #default="{ row }">
            <el-tooltip
              effect="dark"
              placement="top"
              :content="{
                salaryScore: '薪资包',
                techScore: '技术栈发展',
                brandScore: '平台背书',
                wlbScore: '加班强度（越高越轻松）',
                commuteScore: '通勤距离（越高越方便）',
              }[h.key]"
            >
              <span class="cell__score">{{ row[h.key] }}</span>
            </el-tooltip>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="92" align="center">
          <template #default="{ row }">
            <el-tag :type="STATUS_META[row.status as OfferStatus].type" size="small" effect="light">
              {{ STATUS_META[row.status as OfferStatus].label }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status !== 'ACCEPTED'" link type="primary" @click="setStatus(asOffer(row), 'ACCEPTED')">
              接受
            </el-button>
            <el-button v-if="row.status !== 'DECLINED'" link type="primary" @click="setStatus(asOffer(row), 'DECLINED')">
              拒绝
            </el-button>
            <el-button link type="primary" @click="openEdit(asOffer(row))">编辑</el-button>
            <el-button link type="danger" @click="remove(asOffer(row))">删除</el-button>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty description="还没有 Offer，添加两家来对比看看">
            <el-button type="primary" @click="openCreate">添加 Offer</el-button>
          </el-empty>
        </template>
      </el-table>

      <div class="page__pager">
        <el-pagination
          :current-page="query.page"
          :page-size="query.pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="onPageChange"
        />
      </div>
    </el-card>

    <!-- 对比区：勾选 2~5 个才出现 -->
    <el-card v-if="canCompare" class="page__compare" shadow="never">
      <template #header>
        <div class="compare__head">
          <el-icon><Trophy /></el-icon>
          <span>对比 {{ selectedCount }} 个 Offer</span>
          <span class="compare__tip">拖权重滑块，排名会重新算（权重不会保存，每次都是临时的）</span>
        </div>
      </template>
      <OfferCompareBoard :offer-ids="selectedIds" />
    </el-card>

    <el-alert
      v-else
      class="page__hint"
      type="info"
      :closable="false"
      show-icon
      title="在列表里勾选 2~5 个 Offer，这里会出现加权对比和建议"
    />

    <OfferFormDialog v-model="formVisible" :offer="editing" @saved="onSaved" />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-4, 16px);
}

.page__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--mf-space-4, 16px);
}

.page__title {
  margin: 0 0 6px;
  font-size: var(--mf-font-xl, 20px);
  font-weight: 500;
}

.page__desc {
  margin: 0;
  font-size: var(--mf-font-sm, 13px);
  color: var(--mf-text-secondary);
  line-height: 1.6;
  max-width: 640px;
}

.page__card {
  flex: none;
}

.filters {
  display: flex;
  align-items: center;
  gap: var(--mf-space-3, 12px);
  margin-bottom: var(--mf-space-3, 12px);
  flex-wrap: wrap;
}

.filters__hint {
  font-size: var(--mf-font-xs, 12px);
  color: var(--mf-text-tertiary);
}

.cell__company {
  font-weight: 500;
}

.cell__muted {
  color: var(--mf-text-tertiary);
}

.cell__score {
  font-variant-numeric: tabular-nums;
  color: var(--mf-text-primary);
  cursor: help;
}

.page__pager {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--mf-space-3, 12px);
}

.page__hint {
  margin-top: 0;
}

.compare__head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.compare__tip {
  font-size: var(--mf-font-xs, 12px);
  font-weight: 400;
  color: var(--mf-text-tertiary);
}
</style>
