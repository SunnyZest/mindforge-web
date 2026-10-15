<script setup lang="ts">
import { TrendCharts } from '@element-plus/icons-vue'
import { computed, reactive, ref, watch } from 'vue'

import { BizError, type OfferCompareItemVO, type OfferCompareVO, type OfferDimension } from '@mindforge/shared'

import { offerApi } from '@/api/offer'

/**
 * 多 Offer 对比区：权重滑块 + 转置对比表 + 决策建议。
 *
 * ★ 权重**不落库**，全部由这里传给后端。所以拖滑块就是改权重 ——
 *   松手 300ms 后自动重新算，排名实时变（后端是纯本地计算，毫秒级）。
 *
 * ⚠️ 表是【转置】的：行 = 维度，列 = Offer。
 *   5 家公司 5 个维度，正着放（行=公司）要么字挤成一团、要么横向滚动，
 *   转置后宽度只跟公司数量有关，每个格子都放得下数字和公司名。
 */

const props = defineProps<{
  /** 选中的 Offer id，2~5 个 */
  offerIds: string[]
}>()

/** 五个维度：key / 中文 / 取值函数 / 方向提示 */
const DIMENSIONS: { key: OfferDimension; label: string }[] = [
  { key: 'salary', label: '薪资包' },
  { key: 'tech', label: '技术栈发展' },
  { key: 'brand', label: '平台背书' },
  { key: 'wlb', label: '加班强度' },
  { key: 'commute', label: '通勤距离' },
]

/** 权重本地状态：默认五维各 20（等权） */
const weights = reactive<Record<OfferDimension, number>>({
  salary: 20,
  tech: 20,
  brand: 20,
  wlb: 20,
  commute: 20,
})

const loading = ref(false)
const result = ref<OfferCompareVO | null>(null)
const errorMsg = ref('')

let timer: number | undefined

/**
 * 归一化后的占比（后端返回的 weights 加起来 = 1）。
 * 没结果时按滑块粗算，让滑块旁边立刻有feedback。
 */
const weightPercents = computed<Record<OfferDimension, number>>(() => {
  if (result.value) {
    const percentages = {} as Record<OfferDimension, number>
    for (const d of DIMENSIONS) {
      percentages[d.key] = Math.round(result.value.weights[d.key] * 100)
    }
    return percentages
  }
  const sum = DIMENSIONS.reduce((acc, d) => acc + weights[d.key], 0)
  const percentages = {} as Record<OfferDimension, number>
  for (const d of DIMENSIONS) {
    percentages[d.key] = sum > 0 ? Math.round((weights[d.key] / sum) * 100) : 0
  }
  return percentages
})

/** 维度取值：总分和排名也是"行"，所以统一成 ValueOf */
function valueOf(item: OfferCompareItemVO, dim: OfferDimension): number {
  switch (dim) {
    case 'salary':
      return item.salaryScore
    case 'tech':
      return item.techScore
    case 'brand':
      return item.brandScore
    case 'wlb':
      return item.wlbScore
    case 'commute':
      return item.commuteScore
    default: {
      // 穷尽性校验：后端加了新维度这里会编译不过，提醒同步（而不是运行时显示 undefined）
      const exhaustive: never = dim
      throw new Error(`未知维度：${String(exhaustive)}`)
    }
  }
}

/** 这个格子在它那一行是不是最优（后端给的 bestByDimension） */
function isBestCell(dim: OfferDimension, offerId: string): boolean {
  return result.value?.bestByDimension[dim]?.includes(offerId) ?? false
}

/** 排名列：并列时同分同名次，展示成「1」「1」「3」 */
function rankText(item: OfferCompareItemVO): string {
  return String(item.rank)
}

async function compare(): Promise<void> {
  if (props.offerIds.length < 2) return
  loading.value = true
  errorMsg.value = ''
  try {
    result.value = await offerApi.compare({
      offerIds: props.offerIds,
      salaryWeight: weights.salary,
      techWeight: weights.tech,
      brandWeight: weights.brand,
      wlbWeight: weights.wlb,
      commuteWeight: weights.commute,
    })
  } catch (e) {
    result.value = null
    errorMsg.value = e instanceof BizError ? e.message : '对比失败'
  } finally {
    loading.value = false
  }
}

/** 换了选择 / 改了权重 → 防抖重新算（拖滑块时会连续触发） */
watch(
  [() => props.offerIds, () => ({ ...weights })],
  () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(compare, 300)
  },
  { immediate: true },
)
</script>

<template>
  <div class="board" v-loading="loading">
    <!-- 权重滑块 -->
    <div class="board__weights">
      <div class="board__weights-title">各维度权重（0~100，会自动归一化）</div>
      <div class="board__sliders">
        <div v-for="d in DIMENSIONS" :key="d.key" class="board__slider">
          <div class="board__slider-head">
            <span>{{ d.label }}</span>
            <span class="board__pct">{{ weightPercents[d.key] }}%</span>
          </div>
          <el-slider v-model="weights[d.key]" :min="0" :max="100" :step="5" size="small" />
        </div>
      </div>
    </div>

    <el-alert
      v-if="errorMsg"
      :title="errorMsg"
      type="error"
      show-icon
      :closable="false"
      class="board__error"
    />

    <el-empty v-if="!result && !errorMsg" description="正在计算…" :image-size="60" />

    <!-- 对比表：行 = 维度，列 = Offer -->
    <div v-else-if="result" class="board__result">
      <el-table :data="DIMENSIONS" border size="small" class="board__table">
        <el-table-column label="维度" width="110" fixed>
          <template #default="{ row }">{{ row.label }}</template>
        </el-table-column>
        <el-table-column
          v-for="item in result.offers"
          :key="item.offerId"
          :label="item.companyName"
          min-width="120"
          align="center"
        >
          <template #default="{ row }">
            <span :class="{ 'board__best': isBestCell(row.key, item.offerId) }">
              {{ valueOf(item, row.key) }}
            </span>
          </template>
        </el-table-column>
      </el-table>

      <!-- 总分与排名单独一行表，避免塞进上面的维度表 -->
      <div class="board__totals">
        <div class="board__totals-row">
          <span class="board__totals-label">加权总分</span>
          <span v-for="item in result.offers" :key="item.offerId" class="board__totals-cell">
            {{ item.totalScore.toFixed(2) }}
          </span>
        </div>
        <div class="board__totals-row">
          <span class="board__totals-label">排名</span>
          <span v-for="item in result.offers" :key="item.offerId" class="board__totals-cell">
            <el-tag :type="item.rank === 1 ? 'success' : 'info'" size="small" effect="light">
              {{ rankText(item) }}
            </el-tag>
          </span>
        </div>
      </div>

      <!-- 建议 -->
      <div class="board__advice">
        <el-icon><TrendCharts /></el-icon>
        <span>{{ result.recommendation }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-4, 16px);
}

.board__weights-title {
  font-size: var(--mf-font-sm, 13px);
  color: var(--mf-text-secondary);
  margin-bottom: 12px;
}

.board__sliders {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px 20px;
}

.board__slider-head {
  display: flex;
  justify-content: space-between;
  font-size: var(--mf-font-xs, 12px);
  color: var(--mf-text-secondary);
}

.board__pct {
  color: var(--mf-text-primary);
  font-weight: 500;
}

.board__result {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3, 12px);
}

.board__table :deep(.el-table__cell) {
  padding: 4px 0;
}

.board__best {
  color: var(--mf-success);
  font-weight: 500;
}

.board__best::after {
  content: ' ✓';
  font-size: var(--mf-font-xs, 12px);
}

.board__totals {
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-md, 8px);
  overflow: hidden;
}

.board__totals-row {
  display: flex;
  border-bottom: 1px solid var(--mf-glass-border-soft);
}

.board__totals-row:last-child {
  border-bottom: none;
}

.board__totals-label {
  width: 110px;
  flex: none;
  padding: 6px 12px;
  font-size: var(--mf-font-xs, 12px);
  color: var(--mf-text-secondary);
  background: var(--mf-bg-subtle);
}

.board__totals-cell {
  flex: 1;
  min-width: 120px;
  text-align: center;
  padding: 6px 4px;
  color: var(--mf-text-primary);
}

.board__advice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: var(--mf-space-3, 12px);
  border-radius: var(--mf-radius-md, 8px);
  background: var(--mf-bg-subtle);
  color: var(--mf-text-primary);
  line-height: 1.7;
  font-size: var(--mf-font-sm, 13px);
}
</style>
