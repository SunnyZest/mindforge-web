<script setup lang="ts">
import { Collection, Cpu, DataLine, Document, User } from '@element-plus/icons-vue'
import { computed, onMounted, ref, type Component } from 'vue'

import type { DashboardVO } from '@mindforge/shared'
import { BizError } from '@mindforge/shared'

import { dashboardApi } from '@/api/dashboard'
import { useAuthStore } from '@/stores/auth'
import { formatCount } from '@/utils/format'

const auth = useAuthStore()

const loading = ref(false)
const stats = ref<DashboardVO | null>(null)

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

async function load(): Promise<void> {
  loading.value = true
  try {
    stats.value = await dashboardApi.stats()
  } catch (e) {
    ElMessage.error(e instanceof BizError ? e.message : '统计加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="dashboard">
    <el-card shadow="never">
      <div class="card-head">
        <h2 class="card-head__title">数据概览</h2>
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
