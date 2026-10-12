<script setup lang="ts">
import { Check, Clock, Cpu, DataLine, PieChart, Refresh, TrendCharts } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import {
  APPLE_PALETTE,
  BizError,
  formatCount,
  getGlassTooltipOption,
  getPieTooltipOption,
  type UsageByModelVO,
  type UsageDailyVO,
  type UsageSummaryVO,
} from '@mindforge/shared'

import { usageApi } from '@/api/usage'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()

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

/** 成功率 —— 没有请求时返回 null（不是 0，0% 和「没数据」是两回事） */
const successRate = computed(() => {
  const s = summary.value
  if (!s || !s.requests) return null
  return Math.round((s.successCount / s.requests) * 1000) / 10
})

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

/** 场景中文名称映射 */
const SCENE_NAMES: Record<string, string> = {
  RAG_CHAT: 'AI 智能问答',
  INTERVIEW_ANALYZE: '面试复盘分析',
  INTERVIEW_GENERATE: '模拟面试出题',
  EMBEDDING: '知识库向量化',
  RERANK: '文档检索重排',
  RESUME_PARSE: '简历解析提取',
  RESUME_OPTIMIZE: '简历智能打磨',
  RESUME_MATCH: '简历职位匹配',
  JOB_PARSE: '职位 JD 画像',
}

function sceneDisplayName(scene: string): string {
  return SCENE_NAMES[scene] || scene
}

/** 占比图统计维度：scene = 业务场景，model = 模型规格 */
const pieDimension = ref<'scene' | 'model'>('scene')
/** 占比指标：tokens = Token 消耗，requests = 调用频次 */
const pieMetric = ref<'tokens' | 'requests'>('tokens')

// ---------- ECharts 可视化挂载与自适应 ----------
const trendChartRef = ref<HTMLDivElement | null>(null)
const pieChartRef = ref<HTMLDivElement | null>(null)
let trendChartInstance: echarts.ECharts | null = null
let pieChartInstance: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null

function renderTrendChart(): void {
  if (!trendChartRef.value) return
  if (!trendChartInstance) {
    trendChartInstance = echarts.init(trendChartRef.value)
  }

  const isDark = theme.isDark
  const dates = chart.value.map((d) => d.date.slice(5))
  const requests = chart.value.map((d) => d.requests)
  const tokens = chart.value.map((d) => d.totalTokens)

  const option: echarts.EChartsOption = {
    tooltip: {
      ...getGlassTooltipOption(isDark),
      formatter: (params: unknown) => {
        const arr = params as Array<{
          name: string
          seriesName: string
          value: number
          color: string
        }>
        if (!Array.isArray(arr) || !arr.length) return ''
        const date = arr[0].name
        let html = `<div style="font-weight:600;margin-bottom:6px">${date} 日用量</div>`
        arr.forEach((item) => {
          const valStr = formatCount(item.value)
          html += `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin:3px 0">
              <span style="display:flex;align-items:center;gap:6px">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color}"></span>
                ${item.seriesName}
              </span>
              <span style="font-weight:600;font-variant-numeric:tabular-nums">${valStr}</span>
            </div>`
        })
        return html
      },
    },
    legend: {
      data: ['请求次数', '消耗 Token'],
      top: 4,
      right: 36,
      itemGap: 20,
      textStyle: {
        color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.7)',
        fontSize: 12,
      },
    },
    grid: {
      left: '3%',
      right: '6%',
      top: '18%',
      bottom: '6%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' } },
      axisLabel: {
        color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
        fontSize: 11,
      },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: '请求 (次)',
        nameTextStyle: {
          color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
          fontSize: 11,
          align: 'left',
          padding: [0, 0, 8, 4],
        },
        splitLine: {
          lineStyle: {
            color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            type: 'dashed',
          },
        },
        axisLabel: {
          color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
          fontSize: 11,
        },
      },
      {
        type: 'value',
        name: 'Token 消耗',
        nameTextStyle: {
          color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
          fontSize: 11,
          align: 'right',
          padding: [0, 4, 8, 0],
        },
        splitLine: { show: false },
        axisLabel: {
          color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
          fontSize: 11,
          formatter: (v: number) => formatCount(v),
        },
      },
    ],
    series: [
      {
        name: '请求次数',
        type: 'line',
        smooth: true,
        data: requests,
        yAxisIndex: 0,
        showSymbol: false,
        symbolSize: 6,
        itemStyle: { color: '#007aff' },
        lineStyle: { width: 2.5, color: '#007aff' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 122, 255, 0.35)' },
            { offset: 1, color: 'rgba(0, 122, 255, 0.01)' },
          ]),
        },
      },
      {
        name: '消耗 Token',
        type: 'line',
        smooth: true,
        data: tokens,
        yAxisIndex: 1,
        showSymbol: false,
        symbolSize: 6,
        itemStyle: { color: '#af52de' },
        lineStyle: { width: 2, color: '#af52de' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(175, 82, 222, 0.25)' },
            { offset: 1, color: 'rgba(175, 82, 222, 0.01)' },
          ]),
        },
      },
    ],
  }

  trendChartInstance.setOption(option, true)
}

function renderPieChart(): void {
  if (!pieChartRef.value) return
  if (!pieChartInstance) {
    pieChartInstance = echarts.init(pieChartRef.value)
  }

  const isDark = theme.isDark

  // 聚合各模型或场景的数据
  const map = new Map<string, number>()
  byModel.value.forEach((m) => {
    const key = pieDimension.value === 'scene' ? sceneDisplayName(m.scene) : modelName(m)
    const val = pieMetric.value === 'tokens' ? m.totalTokens : m.requests
    map.set(key, (map.get(key) ?? 0) + val)
  })

  const pieData = Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const isTokens = pieMetric.value === 'tokens'
  const unit = isTokens ? 'Token' : '次'

  const option: echarts.EChartsOption = {
    color: APPLE_PALETTE,
    tooltip: {
      ...getPieTooltipOption(isDark),
      formatter: (params: unknown) => {
        const item = params as { name: string; value: number; percent: number; color: string }
        return `
          <div style="font-weight:600;margin-bottom:4px">${item.name}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
            <span style="display:flex;align-items:center;gap:6px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color}"></span>
              ${isTokens ? '消耗占比' : '调用占比'}
            </span>
            <span style="font-weight:600">${item.percent.toFixed(1)}% (${formatCount(item.value)} ${unit})</span>
          </div>`
      },
    },
    legend: {
      orient: 'vertical',
      right: '2%',
      top: 'middle',
      textStyle: {
        color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.7)',
        fontSize: 11,
      },
      itemWidth: 10,
      itemHeight: 10,
      formatter: (name: string) => {
        return name.length > 22 ? name.slice(0, 20) + '…' : name
      },
    },
    series: [
      {
        name: pieDimension.value === 'scene' ? '业务场景分布' : '模型规格分布',
        type: 'pie',
        radius: ['44%', '70%'],
        center: ['35%', '50%'],
        minAngle: 3,
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: isDark ? '#1c1c1e' : '#ffffff',
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 12,
            fontWeight: 'bold',
            formatter: '{b}\n{d}%',
            color: isDark ? '#fff' : '#1d1d1f',
          },
          itemStyle: {
            shadowBlur: 14,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
          },
        },
        data: pieData.length ? pieData : [{ name: '暂无数据', value: 0 }],
      },
    ],
  }

  pieChartInstance.setOption(option, true)
}

function updateAllCharts(): void {
  void nextTick(() => {
    renderTrendChart()
    renderPieChart()
  })
}

watch([chart, byModel], () => {
  updateAllCharts()
})

watch(
  () => theme.isDark,
  () => {
    updateAllCharts()
  },
)

onMounted(() => {
  applyPreset(30)
  resizeObserver = new ResizeObserver(() => {
    trendChartInstance?.resize()
    pieChartInstance?.resize()
  })
  if (trendChartRef.value) resizeObserver.observe(trendChartRef.value)
  if (pieChartRef.value) resizeObserver.observe(pieChartRef.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  trendChartInstance?.dispose()
  pieChartInstance?.dispose()
})

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
      <div class="card mf-glass-card-interactive">
        <div class="card__t">
          <el-icon class="card__icon card__icon--primary"><DataLine /></el-icon>
          <span>请求数</span>
        </div>
        <div class="card__n">{{ formatCount(summary?.requests ?? 0) }}</div>
        <div class="card__sub">
          成功 {{ formatCount(summary?.successCount ?? 0) }} · 失败
          {{ formatCount(summary?.failedCount ?? 0) }}
        </div>
      </div>

      <div class="card mf-glass-card-interactive">
        <div class="card__t">
          <el-icon class="card__icon card__icon--success"><Check /></el-icon>
          <span>成功率</span>
        </div>
        <!-- 没请求时显示「-」而不是 0% -->
        <div class="card__n">{{ successRate === null ? '-' : successRate + '%' }}</div>
        <div class="card__sub">按总请求量统计</div>
      </div>

      <div class="card mf-glass-card-interactive">
        <div class="card__t">
          <el-icon class="card__icon card__icon--purple"><Cpu /></el-icon>
          <span>消耗 Token</span>
        </div>
        <div class="card__n">{{ formatCount(summary?.totalTokens ?? 0) }}</div>
        <div class="card__sub">
          入 {{ formatCount(summary?.promptTokens ?? 0) }} · 出
          {{ formatCount(summary?.completionTokens ?? 0) }}
        </div>
      </div>

      <div class="card mf-glass-card-interactive">
        <div class="card__t">
          <el-icon class="card__icon card__icon--warning"><Clock /></el-icon>
          <span>平均耗时</span>
        </div>
        <div class="card__n">
          {{ summary?.avgDurationMs ? (summary.avgDurationMs / 1000).toFixed(1) + 's' : '-' }}
        </div>
        <div class="card__sub">含端到端网络与生成</div>
      </div>
    </div>

    <!-- ---------- 按天用量趋势 ---------- -->
    <section class="pane mf-glass-card-interactive">
      <div class="pane__head-row">
        <div>
          <h2 class="pane__title">
            <el-icon class="title-icon"><TrendCharts /></el-icon>
            AI 调用量与 Token 消耗趋势
          </h2>
          <p class="pane__note">每日 API 调用频次（左轴）与 Token 吞吐波动曲线（右轴）实时联动监控</p>
        </div>
      </div>

      <div v-show="chart.length" ref="trendChartRef" class="echarts-box echarts-box--trend" />
      <el-empty v-if="!chart.length" :image-size="70" description="这段时间没有记录" />
    </section>

    <!-- ---------- 模型分布与场景明细 ---------- -->
    <div class="model-section-grid">
      <!-- 环形占比图 -->
      <section class="pane mf-glass-card-interactive">
        <div class="pane__head-between">
          <div>
            <h2 class="pane__title">
              <el-icon class="title-icon"><PieChart /></el-icon>
              {{ pieDimension === 'scene' ? '业务场景消耗占比' : '模型规格消耗占比' }}
            </h2>
            <p class="pane__note">
              {{ pieDimension === 'scene' ? '各求职业务模块的模型调用与资源开销' : '不同厂商与模型规格的总体调用比重' }}
            </p>
          </div>
          <div class="pane__toggles">
            <el-radio-group v-model="pieDimension" size="small" @change="renderPieChart">
              <el-radio-button value="scene">按场景</el-radio-button>
              <el-radio-button value="model">按模型</el-radio-button>
            </el-radio-group>
            <el-radio-group v-model="pieMetric" size="small" @change="renderPieChart">
              <el-radio-button value="tokens">Token</el-radio-button>
              <el-radio-button value="requests">频次</el-radio-button>
            </el-radio-group>
          </div>
        </div>

        <div v-show="byModel.length" ref="pieChartRef" class="echarts-box echarts-box--pie" />
        <el-empty v-if="!byModel.length" :image-size="70" description="暂无分布数据" />
      </section>

      <!-- 场景/模型数据表 -->
      <section class="pane mf-glass-card-interactive">
        <h2 class="pane__title">
          <el-icon class="title-icon"><Cpu /></el-icon>
          场景与模型明细
        </h2>
        <p class="pane__note">细粒度请求、成功率与平均延迟数据留痕</p>

        <el-table :data="byModel" border stripe size="small" :row-key="rowKey" max-height="310">
          <el-table-column label="场景" min-width="120">
            <template #default="{ row }">
              <span class="scene-tag">{{ sceneDisplayName(row.scene) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="模型" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ modelName(asModel(row)) }}</template>
          </el-table-column>
          <el-table-column label="请求" width="75" align="right">
            <template #default="{ row }">{{ formatCount(row.requests) }}</template>
          </el-table-column>
          <el-table-column label="成功/失败" width="95" align="right">
            <template #default="{ row }">
              <span class="ok">{{ row.successCount }}</span> /
              <span :class="{ bad: row.failedCount > 0 }">{{ row.failedCount }}</span>
            </template>
          </el-table-column>
          <el-table-column label="Token" width="85" align="right">
            <template #default="{ row }">{{ formatCount(row.totalTokens) }}</template>
          </el-table-column>
          <el-table-column label="耗时" width="75" align="right">
            <template #default="{ row }">
              {{ row.avgDurationMs ? (row.avgDurationMs / 1000).toFixed(1) + 's' : '-' }}
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="!byModel.length" :image-size="70" description="这段时间没有记录" />
      </section>
    </div>
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
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--mf-space-2);
  padding: var(--mf-space-6) var(--mf-space-4);
  border-radius: var(--mf-radius-lg);
  min-height: 146px;
}

.card__t {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--mf-font-sm);
  font-weight: 500;
  color: var(--mf-text-secondary);
}

.card__icon {
  font-size: 15px;
}

.card__icon--primary {
  color: var(--mf-primary);
}

.card__icon--success {
  color: var(--mf-success);
}

.card__icon--purple {
  color: #af52de;
}

.card__icon--warning {
  color: var(--mf-warning);
}

.card__n {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: var(--mf-text-primary);
  font-variant-numeric: tabular-nums;
  margin: 2px 0;
}

.card__sub {
  display: inline-flex;
  align-items: center;
  padding: 3px 12px;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
  background-color: var(--mf-glass-tint-strong);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-pill);
  backdrop-filter: blur(8px);
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

.pane__head-between {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--mf-space-3);
  flex-wrap: wrap;
}

.pane__toggles {
  display: flex;
  align-items: center;
  gap: var(--mf-space-2);
}

/* ---------- 图表容器 ---------- */
.title-icon {
  margin-right: 6px;
  color: var(--mf-primary);
  vertical-align: -2px;
}

.echarts-box {
  width: 100%;
}

.echarts-box--trend {
  height: 320px;
}

.echarts-box--pie {
  height: 320px;
}

.model-section-grid {
  display: grid;
  grid-template-columns: minmax(460px, 1.15fr) 1.85fr;
  gap: var(--mf-space-4);
}

@media (width <= 1180px) {
  .model-section-grid {
    grid-template-columns: 1fr;
  }
}

.scene-tag {
  font-weight: 500;
  color: var(--mf-text-primary);
}

.ok {
  color: var(--mf-success-text);
}

.bad {
  color: var(--mf-danger-text);
}
</style>
