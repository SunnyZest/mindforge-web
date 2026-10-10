<script setup lang="ts">
import { Refresh } from '@element-plus/icons-vue'
import { computed, onMounted, ref } from 'vue'

import {
  BizError,
  formatCount,
  type UsageByModelVO,
  type UsageDailyVO,
  type UsageSummaryVO,
} from '@mindforge/shared'

import { usageApi } from '@/api/usage'

const loading = ref(false)
const summary = ref<UsageSummaryVO | null>(null)
const daily = ref<UsageDailyVO[]>([])
const byModel = ref<UsageByModelVO[]>([])

/** 日期范围 —— 三个接口共用 */
const range = ref<[string, string] | null>(null)

/** 当前选中的快捷范围 —— 只用来高亮按钮，不影响查询 */
const activePreset = ref<number | null>(30)

/** 快捷范围 */
const PRESETS: { label: string; days: number }[] = [
  { label: '近 7 天', days: 7 },
  { label: '近 30 天', days: 30 },
  { label: '近 90 天', days: 90 },
]

function isoDate(d: Date): string {
  // ⚠️ 用本地时间拼，别用 toISOString() —— 那个是 UTC，
  //    东八区下午 4 点后算出来会是「明天」，日期范围整体偏一天。
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function applyPreset(days: number): void {
  activePreset.value = days
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  range.value = [isoDate(from), isoDate(to)]
  void load()
}

/** 手动选了日期 → 快捷按钮不再高亮（它已经不是那个范围了） */
function onRangeChange(): void {
  activePreset.value = null
  void load()
}

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

async function load(): Promise<void> {
  loading.value = true
  const query = range.value ? { from: range.value[0], to: range.value[1] } : {}
  try {
    const [s, d, m] = await Promise.all([
      usageApi.summary(query),
      usageApi.daily(query),
      usageApi.byModel(query),
    ])
    summary.value = s
    daily.value = d
    byModel.value = m
  } catch (e) {
    fail(e, '加载失败')
  } finally {
    loading.value = false
  }
}

/**
 * ★ 按天数据【只返回有记录的天】，直接画图会把稀疏的日子挤在一起，
 *   看起来像「每天都差不多」。所以这里把区间补全（缺的补 0）。
 */
const chart = computed(() => {
  if (!daily.value.length) return []

  const map = new Map(daily.value.map((d) => [d.date, d]))
  const start = range.value?.[0] ?? daily.value[0].date
  const end = range.value?.[1] ?? daily.value[daily.value.length - 1].date

  const out: UsageDailyVO[] = []
  const cursor = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)

  // 上限兜底：范围特别大时不至于生成上万个点
  for (let i = 0; i < 400 && cursor <= last; i++) {
    const key = isoDate(cursor)
    out.push(
      map.get(key) ?? {
        date: key,
        requests: 0,
        successCount: 0,
        failedCount: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    )
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
})

const maxRequests = computed(() => Math.max(1, ...chart.value.map((d) => d.requests)))

/** 成功率 —— 没有请求时返回 null（不是 0，0% 和「没数据」是两回事） */
const successRate = computed(() => {
  const s = summary.value
  if (!s || !s.requests) return null
  return Math.round((s.successCount / s.requests) * 1000) / 10
})

function barHeight(d: UsageDailyVO): string {
  return `${Math.max(d.requests ? 2 : 0, (d.requests / maxRequests.value) * 100)}%`
}

/**
 * el-table 插槽里的 `row` 是 `DefaultRow`（Element Plus 的泛型占位符），
 * 直接传给需要具体类型的方法会报「缺少属性」。转一下即可 ——
 * 和 apps/admin 其它页面里 asLog() / asChunk() 的做法一致。
 */
function asModel(row: unknown): UsageByModelVO {
  return row as UsageByModelVO
}

function modelName(m: UsageByModelVO): string {
  return [m.provider, m.modelName].filter(Boolean).join(' / ') || '（未记录）'
}

/** 表里的模型名可能重复（不同场景用同一个模型），所以 key 要带上场景 */
function rowKey(m: UsageByModelVO, i: number): string {
  return `${m.scene}-${m.provider}-${m.modelName}-${i}`
}

onMounted(() => applyPreset(30))
</script>

<template>
  <div v-loading="loading" class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">AI 用量</h1>
        <p class="page__sub">看请求量、token 消耗和耗时 —— 回答「钱花在哪个场景、哪个模型上」</p>
      </div>

      <div class="page__actions">
        <el-button
          v-for="p in PRESETS"
          :key="p.days"
          size="small"
          :type="activePreset === p.days ? 'primary' : 'default'"
          @click="applyPreset(p.days)"
        >
          {{ p.label }}
        </el-button>

        <el-date-picker
          v-model="range"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始"
          end-placeholder="结束"
          class="page__range"
          @change="onRangeChange"
        />

        <el-button :icon="Refresh" @click="load">刷新</el-button>
      </div>
    </header>

    <!-- ---------- 总览 ---------- -->
    <div class="cards">
      <div class="card">
        <span class="card__n">{{ formatCount(summary?.requests ?? 0) }}</span>
        <span class="card__t">请求数</span>
        <span class="card__sub">
          成功 {{ formatCount(summary?.successCount ?? 0) }} · 失败
          {{ formatCount(summary?.failedCount ?? 0) }}
        </span>
      </div>

      <div class="card">
        <!-- 没请求时显示「-」而不是 0% -->
        <span class="card__n">{{ successRate === null ? '-' : successRate + '%' }}</span>
        <span class="card__t">成功率</span>
        <span class="card__sub">按请求数算</span>
      </div>

      <div class="card">
        <span class="card__n">{{ formatCount(summary?.totalTokens ?? 0) }}</span>
        <span class="card__t">消耗 Token</span>
        <span class="card__sub">
          输入 {{ formatCount(summary?.promptTokens ?? 0) }} · 输出
          {{ formatCount(summary?.completionTokens ?? 0) }}
        </span>
      </div>

      <div class="card">
        <span class="card__n">
          {{ summary?.avgDurationMs ? (summary.avgDurationMs / 1000).toFixed(1) + 's' : '-' }}
        </span>
        <span class="card__t">平均耗时</span>
        <span class="card__sub">含 AI 生成时间</span>
      </div>
    </div>

    <!-- ---------- 按天趋势 ---------- -->
    <section class="pane">
      <h2 class="pane__title">按天请求量</h2>
      <p class="pane__note">
        没有请求的日子补成了 0 —— 不补的话稀疏的日子会被挤在一起，看着像每天都很忙。
      </p>

      <div v-if="chart.length" class="chart">
        <div
          v-for="d in chart"
          :key="d.date"
          class="bar"
          :title="`${d.date}：${d.requests} 次请求 · ${formatCount(d.totalTokens)} token`"
        >
          <div class="bar__fill" :style="{ height: barHeight(d) }" />
          <!-- 只标首尾和峰值附近的日子，全标会糊成一片 -->
          <span class="bar__label">{{ d.date.slice(5) }}</span>
        </div>
      </div>
      <el-empty v-else :image-size="70" description="这段时间没有记录" />
    </section>

    <!-- ---------- 按模型 ---------- -->
    <section class="pane">
      <h2 class="pane__title">按场景 / 模型</h2>

      <el-table :data="byModel" border stripe :row-key="rowKey">
        <el-table-column label="场景" min-width="140">
          <template #default="{ row }">{{ row.scene }}</template>
        </el-table-column>
        <el-table-column label="模型" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ modelName(asModel(row)) }}</template>
        </el-table-column>
        <el-table-column label="请求" width="90" align="right">
          <template #default="{ row }">{{ formatCount(row.requests) }}</template>
        </el-table-column>
        <el-table-column label="成功 / 失败" width="120" align="right">
          <template #default="{ row }">
            <span class="ok">{{ row.successCount }}</span> /
            <span :class="{ bad: row.failedCount > 0 }">{{ row.failedCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Token" width="110" align="right">
          <template #default="{ row }">{{ formatCount(row.totalTokens) }}</template>
        </el-table-column>
        <el-table-column label="平均耗时" width="110" align="right">
          <template #default="{ row }">
            {{ row.avgDurationMs ? (row.avgDurationMs / 1000).toFixed(1) + 's' : '-' }}
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!byModel.length" :image-size="70" description="这段时间没有记录" />
    </section>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-5);
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
  flex-wrap: wrap;
  gap: var(--mf-space-2);
  align-items: center;
}

.page__range {
  width: 260px;
}

/* ---------- 概览卡 ---------- */
.cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--mf-space-4);
}

@media (width <= 900px) {
  .cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

.card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--mf-space-5);
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
}

.card__n {
  font-size: var(--mf-font-xl);
  font-weight: var(--mf-weight-medium);
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.card__t {
  font-size: var(--mf-font-sm);
  color: var(--mf-text-secondary);
}

.card__sub {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

/* ---------- 面板 ---------- */
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
  margin: 0;
  font-size: var(--mf-font-md);
  font-weight: var(--mf-weight-medium);
}

.pane__note {
  margin: calc(-1 * var(--mf-space-1)) 0 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

/* ---------- 柱状图 ---------- */
.chart {
  display: flex;
  gap: 2px;
  align-items: flex-end;
  height: 180px;
  padding-top: var(--mf-space-4);
  overflow-x: auto;
}

.bar {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  min-width: 6px;
  height: 100%;
}

.bar__fill {
  width: 100%;
  min-height: 0;
  background: linear-gradient(
    180deg,
    var(--mf-primary),
    color-mix(in srgb, var(--mf-primary) 55%, transparent)
  );
  border-radius: 3px 3px 0 0;
  transition: height var(--mf-duration-normal) var(--mf-ease-out);
}

.bar:hover .bar__fill {
  filter: brightness(1.12);
}

/* 日期标签旋转 45°，否则 30 根柱子下面会糊成一片 */
.bar__label {
  position: absolute;
  bottom: -18px;
  font-size: 10px;
  color: var(--mf-text-tertiary);
  white-space: nowrap;
  transform: rotate(45deg);
  transform-origin: left top;
}

.ok {
  color: var(--mf-success-text);
}

.bad {
  color: var(--mf-danger-text);
}
</style>
