<script setup lang="ts">
import {
  ArrowRight,
  Briefcase,
  ChatDotRound,
  Check,
  Collection,
  Cpu,
  Document,
  Lightning,
  Microphone,
  User,
} from '@element-plus/icons-vue'
import { computed, type Component } from 'vue'

import type { Permission } from '@mindforge/shared'

import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

interface FlowStep {
  step: string
  title: string
  tag: string
  desc: string
  icon: Component
  to: string
  permission?: Permission
  accentColor: string
}

interface ToolEntry {
  title: string
  desc: string
  icon: Component
  to: string
  permission?: Permission
  comingSoon?: boolean
  accentColor: string
}

/** 核心求职链路：3 步闭环 */
const FLOW_STEPS: FlowStep[] = [
  {
    step: '01',
    title: '我的简历',
    tag: '基础底座',
    desc: '上传你的 PDF/Word 简历，AI 逐段分析亮点与不足，给出量化优化方案。',
    icon: Document,
    to: '/resumes',
    permission: 'app:resume:read',
    accentColor: 'linear-gradient(135deg, #007aff, #00c6ff)',
  },
  {
    step: '02',
    title: '目标职位',
    tag: '需求拆解',
    desc: '录入目标岗位 JD，AI 自动提炼核心硬技能、软素质与潜在考核点。',
    icon: Briefcase,
    to: '/jobs',
    permission: 'app:job:read',
    accentColor: 'linear-gradient(135deg, #5856d6, #af52de)',
  },
  {
    step: '03',
    title: '模拟面试',
    tag: '实战演练',
    desc: '基于你的简历与目标 JD 生成针对性考题，AI 面试官全景复盘评分。',
    icon: Microphone,
    to: '/interviews',
    permission: 'app:interview:read',
    accentColor: 'linear-gradient(135deg, #ff9500, #ff2d55)',
  },
]

/** 辅助中枢工具 */
const TOOLS: ToolEntry[] = [
  {
    title: '知识库中枢',
    desc: '沉淀技术文档、面经真题与学习笔记，支持向量检索与问答引用。',
    icon: Collection,
    to: '/knowledge',
    permission: 'app:knowledge:read',
    accentColor: 'linear-gradient(135deg, #30b0c7, #34c759)',
  },
  {
    title: 'AI 智能问答',
    desc: '基于你的专属知识库发起对话，每一条回答精准溯源到原文段落。',
    icon: ChatDotRound,
    to: '/chat',
    permission: 'app:rag:search',
    accentColor: 'linear-gradient(135deg, #007aff, #5856d6)',
  },
  {
    title: '个人中心',
    desc: '查看与维护个人基本信息、偏好设置与安全凭据。',
    icon: User,
    to: '/profile',
    accentColor: 'linear-gradient(135deg, #8e8e93, #636366)',
  },
]

const visibleFlowSteps = computed(() =>
  FLOW_STEPS.filter((s) => !s.permission || auth.can(s.permission)),
)

const visibleTools = computed(() => TOOLS.filter((t) => !t.permission || auth.can(t.permission)))

/** 按时间段问候 */
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})
</script>

<template>
  <div class="ws">
    <!-- ---------- 顶部仪表控制台 ---------- -->
    <header class="ws__hero mf-glass-card-interactive">
      <div class="ws__hero-left">
        <div class="ws__badge-bar">
          <span class="ws__pill ws__pill--success">
            <span class="ws__dot" />
            AI 引擎就绪
          </span>
          <span class="ws__pill">
            <el-icon><Cpu /></el-icon>
            DeepSeek-V3 / Qwen 双核驱动
          </span>
          <span class="ws__pill">
            <el-icon><Lightning /></el-icon>
            RAG 知识图谱已连接
          </span>
        </div>
        <h1 class="ws__hello">{{ greeting }}，{{ auth.displayName || '探索者' }}</h1>
        <p class="ws__sub">
          构建以 AI 为核心的求职飞轮：从简历雕琢、岗位对齐到全拟真面试，打造你的专属求职壁垒。
        </p>
      </div>

      <div class="ws__hero-tip">
        <div class="tip-card">
          <div class="tip-card__head">
            <el-icon class="tip-card__icon"><Check /></el-icon>
            <span class="tip-card__title">推荐求职路径</span>
          </div>
          <p class="tip-card__body">
            建议先上传简历并录入目标 JD，模拟面试将依据二者的交叉匹配度生成高命中真题。
          </p>
        </div>
      </div>
    </header>

    <!-- ---------- 核心流程 3 步闭环 ---------- -->
    <section class="ws__section">
      <div class="section__header">
        <div class="section__title-wrap">
          <h2 class="section__title">求职核心链路</h2>
          <span class="section__sub">遵循闭环步骤准备，面试通过率提升 200%</span>
        </div>
        <div class="pipeline-badge">3 步核心闭环</div>
      </div>

      <div class="pipeline-grid">
        <router-link
          v-for="s in visibleFlowSteps"
          :key="s.step"
          :to="s.to"
          class="step-card mf-glass-card-interactive"
        >
          <div class="step-card__top">
            <div class="step-card__badge">{{ s.step }}</div>
            <span class="step-card__tag">{{ s.tag }}</span>
          </div>

          <div class="step-card__icon-box" :style="{ background: s.accentColor }">
            <el-icon class="step-card__icon"><component :is="s.icon" /></el-icon>
          </div>

          <div class="step-card__content">
            <h3 class="step-card__title">{{ s.title }}</h3>
            <p class="step-card__desc">{{ s.desc }}</p>
          </div>

          <div class="step-card__footer">
            <span class="step-card__action">立即前往</span>
            <el-icon class="step-card__arrow"><ArrowRight /></el-icon>
          </div>
        </router-link>
      </div>
    </section>

    <!-- ---------- 辅助智囊与知识中枢 ---------- -->
    <section class="ws__section">
      <div class="section__header">
        <div class="section__title-wrap">
          <h2 class="section__title">知识中枢与工具</h2>
          <span class="section__sub">沉淀领域资料，随时向 AI 发起溯源提问</span>
        </div>
      </div>

      <div class="tools-grid">
        <router-link
          v-for="t in visibleTools"
          :key="t.title"
          :to="t.to"
          class="tool-card mf-glass-card-interactive"
        >
          <div class="tool-card__icon" :style="{ background: t.accentColor }">
            <el-icon><component :is="t.icon" /></el-icon>
          </div>

          <div class="tool-card__info">
            <div class="tool-card__head">
              <span class="tool-card__title">{{ t.title }}</span>
              <span v-if="t.comingSoon" class="tool-card__soon">建设中</span>
            </div>
            <p class="tool-card__desc">{{ t.desc }}</p>
          </div>

          <el-icon class="tool-card__arrow"><ArrowRight /></el-icon>
        </router-link>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ws {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-8);
  max-width: 1140px;
  margin: 0 auto;
  padding-bottom: var(--mf-space-8);
}

/* ---------- 顶部 Hero 区域 ---------- */
.ws__hero {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-6);
  justify-content: space-between;
  align-items: center;
  padding: var(--mf-space-6) var(--mf-space-8);
  border-radius: var(--mf-radius-xl);
}

.ws__hero-left {
  flex: 1;
  min-width: 300px;
}

.ws__badge-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-2);
  margin-bottom: var(--mf-space-3);
}

.ws__pill {
  display: inline-flex;
  gap: var(--mf-space-1);
  align-items: center;
  padding: 3px 10px;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
  background-color: var(--mf-glass-tint-strong);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-pill);
  backdrop-filter: blur(8px);
}

.ws__pill--success {
  color: var(--mf-success-text);
  background-color: var(--mf-success-subtle);
  border-color: transparent;
}

.ws__dot {
  width: 6px;
  height: 6px;
  background-color: var(--mf-success);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--mf-success);
}

.ws__hello {
  margin: 0 0 var(--mf-space-2);
  font-size: var(--mf-font-xl);
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--mf-text-primary);
}

.ws__sub {
  margin: 0;
  font-size: var(--mf-font-sm);
  line-height: 1.6;
  color: var(--mf-text-secondary);
  max-width: 620px;
}

.ws__hero-tip {
  flex: none;
  width: 290px;
}

.tip-card {
  padding: var(--mf-space-4);
  background: var(--mf-glass-tint);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-md);
}

.tip-card__head {
  display: flex;
  gap: var(--mf-space-1);
  align-items: center;
  margin-bottom: var(--mf-space-2);
}

.tip-card__icon {
  font-size: var(--mf-font-sm);
  color: var(--mf-primary);
}

.tip-card__title {
  font-size: var(--mf-font-xs);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-primary-text);
  letter-spacing: 0.02em;
}

.tip-card__body {
  margin: 0;
  font-size: var(--mf-font-xs);
  line-height: 1.5;
  color: var(--mf-text-secondary);
}

/* ---------- 分区排版 ---------- */
.ws__section {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-4);
}

.section__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.section__title-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.section__title {
  margin: 0;
  font-size: var(--mf-font-lg);
  font-weight: 600;
  letter-spacing: -0.02em;
}

.section__sub {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.pipeline-badge {
  padding: 4px 12px;
  font-size: var(--mf-font-xs);
  font-weight: 500;
  color: var(--mf-primary-text);
  background-color: var(--mf-primary-subtle);
  border-radius: var(--mf-radius-pill);
}

/* ---------- 核心闭环 3 列卡片 ---------- */
.pipeline-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--mf-space-5);
}

@media (width <= 880px) {
  .pipeline-grid {
    grid-template-columns: 1fr;
  }
}

.step-card {
  display: flex;
  flex-direction: column;
  padding: var(--mf-space-6);
  text-decoration: none;
  color: inherit;
  border-radius: var(--mf-radius-xl);
  min-height: 240px;
}

.step-card__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--mf-space-4);
}

.step-card__badge {
  font-size: var(--mf-font-sm);
  font-weight: 700;
  font-family: var(--mf-font-mono, monospace);
  color: var(--mf-text-tertiary);
  letter-spacing: 0.05em;
}

.step-card__tag {
  padding: 2px 8px;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
  background-color: var(--mf-glass-tint-strong);
  border-radius: var(--mf-radius-pill);
}

.step-card__icon-box {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin-bottom: var(--mf-space-4);
  border-radius: var(--mf-radius-md);
  color: #fff;
  box-shadow: 0 8px 18px rgb(0 0 0 / 12%);
}

.step-card__icon {
  font-size: 24px;
}

.step-card__content {
  flex: 1;
}

.step-card__title {
  margin: 0 0 var(--mf-space-2);
  font-size: var(--mf-font-lg);
  font-weight: 600;
  letter-spacing: -0.01em;
}

.step-card__desc {
  margin: 0;
  font-size: var(--mf-font-xs);
  line-height: 1.6;
  color: var(--mf-text-secondary);
}

.step-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--mf-space-5);
  padding-top: var(--mf-space-3);
  border-top: 1px solid var(--mf-glass-border-soft);
  font-size: var(--mf-font-xs);
  font-weight: 500;
  color: var(--mf-primary-text);
}

.step-card__arrow {
  transition: transform var(--mf-duration-fast) var(--mf-ease-spring);
}

.step-card:hover .step-card__arrow {
  transform: translateX(4px);
}

/* ---------- 辅助工具网格 ---------- */
.tools-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--mf-space-4);
}

@media (width <= 880px) {
  .tools-grid {
    grid-template-columns: 1fr;
  }
}

.tool-card {
  display: flex;
  gap: var(--mf-space-4);
  align-items: center;
  padding: var(--mf-space-5);
  text-decoration: none;
  color: inherit;
  border-radius: var(--mf-radius-lg);
}

.tool-card__icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 42px;
  height: 42px;
  font-size: 20px;
  color: #fff;
  border-radius: var(--mf-radius-md);
  box-shadow: 0 6px 14px rgb(0 0 0 / 10%);
}

.tool-card__info {
  flex: 1;
  min-width: 0;
}

.tool-card__head {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
}

.tool-card__title {
  font-size: var(--mf-font-sm);
  font-weight: 600;
}

.tool-card__soon {
  padding: 1px 6px;
  font-size: 10px;
  color: var(--mf-warning-text);
  background-color: var(--mf-warning-subtle);
  border-radius: var(--mf-radius-pill);
}

.tool-card__desc {
  margin: 3px 0 0;
  font-size: var(--mf-font-xs);
  line-height: 1.4;
  color: var(--mf-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-card__arrow {
  flex: none;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
  transition: transform var(--mf-duration-fast) var(--mf-ease-spring);
}

.tool-card:hover .tool-card__arrow {
  transform: translateX(3px);
  color: var(--mf-primary);
}
</style>
