<script setup lang="ts">
import {
  ArrowRight,
  Bell,
  Collection,
  Cpu,
  DataLine,
  Document,
  Operation,
  Reading,
  User,
} from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type Component } from 'vue'
import { isNavigationFailure, NavigationFailureType, useRoute, useRouter } from 'vue-router'

import type { DashboardVO, Permission, UsageSummaryVO } from '@mindforge/shared'
import { BizError, formatCount } from '@mindforge/shared'

import { alertApi } from '@/api/alert'
import { dashboardApi } from '@/api/dashboard'
import { usageApi } from '@/api/usage'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const theme = useThemeStore()

const loading = ref(false)
const stats = ref<DashboardVO | null>(null)
const usageSummary = ref<UsageSummaryVO | null>(null)
const unreadAlertCount = ref(0)

/**
 * 统计项的静态定义。
 *
 * ★ 数据（`stats`）和展示（这张表）分开：
 *   接口返回的是一堆平铺的字段，页面要的是「图标 + 标签 + 单位」。
 *   把两件事混在模板里，加一个指标就得改三处。
 */
const METRICS: Array<{
  key: keyof DashboardVO
  label: string
  icon: Component
  unit?: string
}> = [
  { key: 'userCount', label: '用户总数', icon: User, unit: '人' },
  { key: 'knowledgeBaseCount', label: '知识库', icon: Collection, unit: '个' },
  { key: 'documentCount', label: '文档数', icon: Document, unit: '份' },
  { key: 'aiRequestCount', label: 'AI 调用', icon: Cpu, unit: '次' },
  { key: 'tokenUsage', label: '消耗 Token', icon: DataLine },
]

const metrics = computed(() =>
  METRICS.map((m) => ({
    ...m,
    // 加载中 / 失败时 stats 是 null —— 显示占位符，别显示 0（0 是有意义的真实值）
    value: stats.value ? formatCount(stats.value[m.key]) : '-',
  })),
)

const aiAvgLatency = computed(() => {
  if (!usageSummary.value?.avgDurationMs) return '-'
  return `${usageSummary.value.avgDurationMs}ms`
})

// ---------- 快捷通道定义 ----------
interface QuickAction {
  label: string
  path: string
  permission?: Permission
  icon: Component
  desc: string
  badge?: () => number
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: '用户与角色',
    path: '/users',
    permission: 'admin:user:list',
    icon: User,
    desc: '账号生命周期与权限分配',
  },
  {
    label: '知识库管理',
    path: '/knowledge-bases',
    permission: 'admin:knowledge:list',
    icon: Collection,
    desc: '知识库与文档分块处理',
  },
  {
    label: '高危告警中心',
    path: '/alerts',
    permission: 'admin:alert:list',
    icon: Bell,
    desc: '高危操作即时留痕与确认',
    badge: () => unreadAlertCount.value,
  },
  {
    label: '提示词版本',
    path: '/prompts',
    permission: 'admin:prompt:manage',
    icon: Reading,
    desc: '多场景提示词灰度与发布',
  },
  {
    label: 'AI 模型管控',
    path: '/ai-models',
    permission: 'admin:ai:manage',
    icon: Operation,
    desc: '对话与嵌入模型配置',
  },
  {
    label: '调用用量大盘',
    path: '/usage',
    permission: 'admin:usage:read',
    icon: DataLine,
    desc: '按天趋势与模型成本分析',
  },
]

/** 仅展示当前登录管理员具备权限的模块，杜绝越权无效点击或误拦截弹回 */
const quickActions = computed(() =>
  QUICK_ACTIONS.filter((a) => !a.permission || auth.can(a.permission)),
)

/** 统一导航处理：当前路径短路防御与防抖，捕获重复及覆盖异常 */
function navigate(path: string): void {
  if (route.path === path) return
  void router.push(path).catch((err) => {
    if (
      isNavigationFailure(err, NavigationFailureType.duplicated | NavigationFailureType.cancelled)
    ) {
      return
    }
    console.error('[DashboardView] 导航跳转失败:', err)
  })
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const [dashRes, usageRes, alertRes] = await Promise.allSettled([
      dashboardApi.stats(),
      usageApi.summary(),
      alertApi.unreadCount(),
    ])

    if (dashRes.status === 'fulfilled') {
      stats.value = dashRes.value
    } else {
      const err = dashRes.reason
      ElMessage.error(err instanceof BizError ? err.message : '大盘统计加载失败')
    }

    if (usageRes.status === 'fulfilled') {
      usageSummary.value = usageRes.value
    }

    if (alertRes.status === 'fulfilled') {
      unreadAlertCount.value = alertRes.value
    }

    void nextTick(() => renderGauge())
  } finally {
    loading.value = false
  }
}

// ---------- AI 运行健康度半环仪表盘 ----------
const aiGaugeRef = ref<HTMLDivElement | null>(null)
let gaugeInstance: echarts.ECharts | null = null
let gaugeResizeObserver: ResizeObserver | null = null

function renderGauge(): void {
  if (!aiGaugeRef.value) return
  if (!gaugeInstance) {
    gaugeInstance = echarts.init(aiGaugeRef.value)
  }

  const isDark = theme.isDark
  const rawRate = usageSummary.value?.requests
    ? (usageSummary.value.successCount / usageSummary.value.requests) * 100
    : 100
  const rateVal = Math.round(rawRate * 10) / 10

  const option: echarts.EChartsOption = {
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        center: ['50%', '76%'],
        radius: '100%',
        min: 0,
        max: 100,
        splitNumber: 5,
        axisLine: {
          lineStyle: {
            width: 10,
            color: [
              [0.2, '#ff3b30'],
              [0.8, '#ff9500'],
              [1, '#34c759'],
            ],
          },
        },
        pointer: {
          icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
          length: '12%',
          width: 6,
          offsetCenter: [0, '-54%'],
          itemStyle: {
            color: isDark ? '#fff' : '#1d1d1f',
          },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        title: {
          offsetCenter: [0, '-15%'],
          fontSize: 11,
          color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
        },
        detail: {
          fontSize: 22,
          offsetCenter: [0, '-36%'],
          valueAnimation: true,
          formatter: (value: number) => `${value.toFixed(1)}%`,
          color: isDark ? '#fff' : '#1d1d1f',
          fontWeight: 'bold',
        },
        data: [{ value: rateVal, name: '调用成功率' }],
      },
    ],
  }

  gaugeInstance.setOption(option, true)
}

watch(
  () => theme.isDark,
  () => {
    void nextTick(() => renderGauge())
  },
)

onMounted(() => {
  void load()
  gaugeResizeObserver = new ResizeObserver(() => {
    gaugeInstance?.resize()
  })
  if (aiGaugeRef.value) gaugeResizeObserver.observe(aiGaugeRef.value)
})

onUnmounted(() => {
  gaugeResizeObserver?.disconnect()
  gaugeInstance?.dispose()
})
</script>

<template>
  <div class="dashboard">
    <!-- 顶部数据大盘 -->
    <el-card shadow="never">
      <div class="card-head">
        <div>
          <h2 class="card-head__title">数据概览</h2>
          <p class="card-head__desc">全站核心资源与服务实时统计</p>
        </div>
        <el-button :loading="loading" @click="load">刷新</el-button>
      </div>

      <div v-loading="loading" class="metrics">
        <div v-for="m in metrics" :key="m.key" class="metric">
          <span class="metric__icon">
            <el-icon><component :is="m.icon" /></el-icon>
          </span>
          <div class="metric__body">
            <span class="metric__label">{{ m.label }}</span>
            <span class="metric__value">
              {{ m.value }}<span v-if="m.unit" class="metric__unit">{{ m.unit }}</span>
            </span>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 中部双列：AI 态势 + 快捷入口 -->
    <div class="dashboard__mid">
      <!-- AI 服务运行态势 -->
      <el-card shadow="never" class="ai-card">
        <div class="card-head">
          <div class="ai-card__head">
            <el-icon class="ai-card__icon"><Cpu /></el-icon>
            <h3 class="card-head__sub">AI 运行健康度</h3>
          </div>
          <el-button
            v-if="auth.can('admin:usage:read')"
            text
            size="small"
            type="primary"
            @click="navigate('/usage')"
          >
            用量详情 <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>

        <div v-loading="loading" class="ai-body">
          <div ref="aiGaugeRef" class="ai-gauge-box" />

          <div class="ai-stats-row">
            <div class="ai-stat-mini">
              <span class="ai-stat__label">平均响应延迟</span>
              <span class="ai-stat__value">{{ aiAvgLatency }}</span>
              <span class="ai-stat__hint">模型平均生成耗时</span>
            </div>

            <div class="ai-stat-mini">
              <span class="ai-stat__label">输入 / 输出 Token</span>
              <span class="ai-stat__value">
                {{ formatCount(usageSummary?.promptTokens ?? 0) }} /
                {{ formatCount(usageSummary?.completionTokens ?? 0) }}
              </span>
              <span class="ai-stat__hint">提示词与生成文本分布</span>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 快捷工作台 -->
      <el-card shadow="never" class="shortcuts-card">
        <div class="card-head">
          <h3 class="card-head__sub">常用管理工作台</h3>
          <span class="shortcuts-hint">高频功能直达</span>
        </div>

        <div class="shortcuts">
          <button
            v-for="a in quickActions"
            :key="a.path"
            type="button"
            class="shortcut"
            @click="navigate(a.path)"
          >
            <span class="shortcut__icon">
              <el-icon><component :is="a.icon" /></el-icon>
            </span>
            <div class="shortcut__info">
              <div class="shortcut__title-row">
                <span class="shortcut__title">{{ a.label }}</span>
                <el-badge
                  v-if="a.badge && a.badge() > 0"
                  :value="a.badge()"
                  :max="99"
                  type="danger"
                />
              </div>
              <span class="shortcut__desc">{{ a.desc }}</span>
            </div>
            <el-icon class="shortcut__arrow"><ArrowRight /></el-icon>
          </button>
        </div>
      </el-card>
    </div>

    <!-- 底部管理员身份 -->
    <el-card shadow="never">
      <h2 class="card-head__title">
        你好，{{ auth.user?.nickname || auth.user?.username || '管理员' }}
      </h2>

      <el-descriptions :column="1" border class="info">
        <el-descriptions-item label="用户 ID">{{ auth.user?.id }}</el-descriptions-item>
        <el-descriptions-item label="用户名">{{ auth.user?.username }}</el-descriptions-item>
        <el-descriptions-item label="角色">
          <span class="roles">
            <el-tag v-for="r in auth.user?.roles" :key="r" size="small">{{ r }}</el-tag>
            <span v-if="!auth.user?.roles?.length">-</span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="权限数">
          {{ auth.permissions.length }} 项
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-4);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--mf-space-4);
}

.card-head__title {
  margin: 0;
  font-size: var(--mf-font-lg);
  font-weight: var(--mf-weight-medium);
  letter-spacing: -0.02em;
}

.card-head__desc {
  margin: 4px 0 0;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.card-head__sub {
  margin: 0;
  font-size: var(--mf-font-md);
  font-weight: var(--mf-weight-medium);
}

.dashboard__mid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--mf-space-4);
}

@media (max-width: 992px) {
  .dashboard__mid {
    grid-template-columns: 1fr;
  }
}

/* ---------- AI 服务运行态势 ---------- */
.ai-card__head {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
}

.ai-card__icon {
  font-size: var(--mf-font-md);
  color: var(--mf-primary);
}

.ai-body {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3);
}

.ai-gauge-box {
  width: 100%;
  height: 155px;
}

.ai-stats-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--mf-space-2);
}

.ai-stat-mini {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--mf-space-3);
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-md);
}

.ai-stat__label {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.ai-stat__value {
  font-size: var(--mf-font-md);
  font-weight: var(--mf-weight-semibold);
  letter-spacing: -0.02em;
  color: var(--mf-text-primary);
}

.ai-stat__hint {
  font-size: 11px;
  color: var(--mf-text-tertiary);
}

/* ---------- 快捷工作台 ---------- */
.shortcuts-hint {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.shortcuts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--mf-space-2);
}

.shortcut {
  display: flex;
  gap: var(--mf-space-3);
  align-items: center;
  padding: var(--mf-space-3);
  background: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-md);
  cursor: pointer;
  text-align: left;
  transition: all var(--mf-duration-fast) var(--mf-ease-out);
}

.shortcut:hover {
  background: var(--mf-glass-tint-strong);
  border-color: var(--mf-primary);
  transform: translateY(-1px);
}

.shortcut:focus-visible {
  outline: 2px solid var(--mf-primary);
  outline-offset: 2px;
}

.shortcut__icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: var(--mf-radius-sm);
  background-color: var(--mf-primary-subtle);
  color: var(--mf-primary-text);
  font-size: var(--mf-font-sm);
}

.shortcut__info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.shortcut__title-row {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
}

.shortcut__title {
  font-size: var(--mf-font-sm);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-primary);
}

.shortcut__desc {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shortcut__arrow {
  color: var(--mf-text-tertiary);
  font-size: var(--mf-font-xs);
  transition: transform var(--mf-duration-fast) var(--mf-ease-out);
}

.shortcut:hover .shortcut__arrow {
  color: var(--mf-primary);
  transform: translateX(2px);
}

/* ★ 五个指标放在【一张】卡片里，而不是五张玻璃卡 ——
   一屏内的玻璃面板有性能预算（≤5~6 个），侧边栏 + 顶栏已经占了两格。
   用网格分隔线做视觉切分，不需要额外的玻璃面。 */
.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1px;
  background-color: var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
  overflow: hidden;
}

.metric {
  display: flex;
  gap: var(--mf-space-3);
  align-items: center;
  padding: var(--mf-space-4);
  background-color: var(--mf-glass-card);
}

.metric__icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: var(--mf-radius-md);
  background-color: var(--mf-primary-subtle);
  color: var(--mf-primary-text);
  font-size: var(--mf-font-md);
}

.metric__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.metric__label {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
}

.metric__value {
  font-size: var(--mf-font-xl);
  font-weight: var(--mf-weight-medium);
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.metric__unit {
  margin-left: 2px;
  font-size: var(--mf-font-xs);
  font-weight: var(--mf-weight-normal);
  color: var(--mf-text-tertiary);
}

.info {
  max-width: 520px;
}

.roles {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--mf-space-1);
}
</style>
