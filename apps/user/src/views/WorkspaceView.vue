<script setup lang="ts">
import {
  Aim,
  ArrowRight,
  Briefcase,
  ChatDotRound,
  Check,
  CircleCheck,
  Collection,
  Cpu,
  Document,
  Lightning,
  Lock,
  Microphone,
  Star,
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
  highlights: string[]
  icon: Component
  to: string
  permission?: Permission
  accentColor: string
}

interface ToolEntry {
  title: string
  tag: string
  desc: string
  features: string[]
  icon: Component
  to: string
  permission?: Permission
  comingSoon?: boolean
  accentColor: string
  actionText: string
}

interface Differentiator {
  icon: Component
  badge: string
  title: string
  vsTraditional: string
  mindforgeAdvantage: string
  accentColor: string
}

/** 核心求职链路：3 步闭环 */
const FLOW_STEPS: FlowStep[] = [
  {
    step: '01',
    title: '我的简历',
    tag: '基础底座',
    desc: '深度解析 PDF / Word 简历，智能结构化提炼经历，AI 针对性提供量化打磨建议。',
    highlights: ['结构化信息提取', '逐段量化润色', '格式排版建议'],
    icon: Document,
    to: '/resumes',
    permission: 'app:resume:read',
    accentColor: 'linear-gradient(135deg, #007aff, #00c6ff)',
  },
  {
    step: '02',
    title: '目标职位',
    tag: '需求拆解',
    desc: '一键录入目标公司 JD，智能提炼硬技能考核点与工作职责画像，为面试指明方向。',
    highlights: ['硬技能权重提取', '岗位画像建模', '匹配契合度诊断'],
    icon: Briefcase,
    to: '/jobs',
    permission: 'app:job:read',
    accentColor: 'linear-gradient(135deg, #5856d6, #af52de)',
  },
  {
    step: '03',
    title: '模拟面试',
    tag: '实战演练',
    desc: '结合你的简历与目标岗位交叉出题，拟真技术与 HR 专家追问，生成全景诊断复盘报告。',
    highlights: ['简历-JD交叉真题', '多轮动态深度追问', '五维能力雷达评分'],
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
    tag: '私域资产',
    desc: '上传专属技术笔记、面经真题与公司业务资料，毫秒级向量化切片沉淀。',
    features: ['支持 PDF / DOCX / MD 批量入库', '智能文本语义分块与高维向量化'],
    icon: Collection,
    to: '/knowledge',
    permission: 'app:knowledge:read',
    accentColor: 'linear-gradient(135deg, #30b0c7, #34c759)',
    actionText: '进入中枢',
  },
  {
    title: 'AI 智能问答',
    tag: 'RAG 溯源',
    desc: '基于你的专属知识库发起对话，每一条回答精准溯源到原文段落与引用依据。',
    features: ['融合混合向量与全文检索', '拒绝模型幻觉·段落级可信溯源'],
    icon: ChatDotRound,
    to: '/chat',
    permission: 'app:rag:search',
    accentColor: 'linear-gradient(135deg, #007aff, #5856d6)',
    actionText: '发起问答',
  },
  {
    title: '个人中心',
    tag: '账号安全',
    desc: '个性化资料维护、求职意向偏好设定与安全凭据管理。',
    features: ['多维个人属性配置', '账号安全与偏好管理'],
    icon: User,
    to: '/profile',
    accentColor: 'linear-gradient(135deg, #8e8e93, #636366)',
    actionText: '查看资料',
  },
]

/** 平台核心优势与差异化特点 */
const DIFFERENTIATORS: Differentiator[] = [
  {
    icon: Lightning,
    badge: '闭环飞轮',
    title: '从割裂准备到三步闭环',
    vsTraditional: '传统求职平台或普通改简历工具只做单点，简历、职位要求与面试题目完全脱节。',
    mindforgeAdvantage:
      'MindForge 将简历优化、JD 解析与模拟面试紧密串联，以目标岗位为导向持续迭代简历，形成求职能力闭环飞轮。',
    accentColor: '#007aff',
  },
  {
    icon: Cpu,
    badge: '双核智能',
    title: '双核大模型深度交叉命题',
    vsTraditional: '通用 AI 问答只能生成泛泛而谈的网推八股文，无法结合求职者真实经历展开深度压力面。',
    mindforgeAdvantage:
      '整合 DeepSeek-V3 强逻辑推理与阿里 Qwen 实战工程经验，基于求职者项目经历与目标 JD 针对性提问与深挖。',
    accentColor: '#af52de',
  },
  {
    icon: Aim,
    badge: '精准溯源',
    title: '私域 RAG 知识库，零幻觉溯源',
    vsTraditional: '遇到小众或企业内部定制化技术时，通用模型容易凭空捏造答案，缺乏参考信度。',
    mindforgeAdvantage:
      '内置企业级私域向量数据库，问答时强制结合你的知识库文档，并在回复中直接高亮显示原文出处与切片来源。',
    accentColor: '#30b0c7',
  },
  {
    icon: Lock,
    badge: '隐私沙箱',
    title: '求职资产私有隔离与数据零泄露',
    vsTraditional: '传统招聘工具或公开 AI 会将你的简历、经历沉淀为公开训练数据，求职意向存在向现公司或第三方泄露的风险。',
    mindforgeAdvantage:
      '个人简历、意向 JD 与问答面经全程处于专属隔离沙箱中，严格遵循企业级私有加密存储，绝不参与公网模型训练，坚决守护求职隐私。',
    accentColor: '#ff9500',
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
            AI 核心引擎就绪
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
        <h1 class="ws__hello">{{ greeting }}，{{ auth.displayName || '求职探索者' }}</h1>
        <p class="ws__sub">
          欢迎使用 <strong>MindForge AI</strong> ——
          新一代沉浸式 AI 求职备战中枢。告别死记硬背与盲目海投，构建「简历打磨 ➔ 职位对齐 ➔
          真实模拟」的全链路求职能力壁垒。
        </p>
      </div>

      <div class="ws__hero-tip">
        <div class="tip-card">
          <div class="tip-card__head">
            <el-icon class="tip-card__icon"><Star /></el-icon>
            <span class="tip-card__title">高效通关建议</span>
          </div>
          <p class="tip-card__body">
            建议先上传简历并录入目标 JD，AI 面试官将精准锚定二者的交集展开针对性出题。
          </p>
        </div>
      </div>
    </header>

    <!-- ---------- 核心流程 3 步闭环 ---------- -->
    <section class="ws__section">
      <div class="section__header">
        <div class="section__title-wrap">
          <div class="section__tag-row">
            <h2 class="section__title">求职核心链路</h2>
            <span class="pipeline-badge">3 步核心闭环</span>
          </div>
          <span class="section__sub">
            循序渐进构建求职飞轮，每一步环环相扣，面试通过率显著提升
          </span>
        </div>
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

            <ul class="step-card__highlights">
              <li v-for="h in s.highlights" :key="h">
                <el-icon class="highlight-check"><Check /></el-icon>
                <span>{{ h }}</span>
              </li>
            </ul>
          </div>

          <div class="step-card__footer">
            <span class="step-card__action">进入步骤 {{ s.step }}</span>
            <div class="step-card__arrow-circle">
              <el-icon><ArrowRight /></el-icon>
            </div>
          </div>
        </router-link>
      </div>
    </section>

    <!-- ---------- 辅助智囊与知识中枢 ---------- -->
    <section class="ws__section">
      <div class="section__header">
        <div class="section__title-wrap">
          <h2 class="section__title">知识中枢与工具箱</h2>
          <span class="section__sub">沉淀私域技术笔记与真题，随时向 AI 发起段落级溯源提问</span>
        </div>
      </div>

      <div class="tools-grid">
        <router-link
          v-for="t in visibleTools"
          :key="t.title"
          :to="t.to"
          class="tool-card mf-glass-card-interactive"
        >
          <div class="tool-card__header-row">
            <div class="tool-card__icon-wrap" :style="{ background: t.accentColor }">
              <el-icon><component :is="t.icon" /></el-icon>
            </div>
            <div class="tool-card__title-meta">
              <div class="tool-card__name-line">
                <span class="tool-card__title">{{ t.title }}</span>
                <span class="tool-card__tag">{{ t.tag }}</span>
                <span v-if="t.comingSoon" class="tool-card__soon">建设中</span>
              </div>
              <span class="tool-card__desc">{{ t.desc }}</span>
            </div>
          </div>

          <div class="tool-card__features">
            <div v-for="f in t.features" :key="f" class="feature-item">
              <span class="feature-dot" />
              <span>{{ f }}</span>
            </div>
          </div>

          <div class="tool-card__footer">
            <span class="tool-card__btn">{{ t.actionText }}</span>
            <el-icon class="tool-card__arrow"><ArrowRight /></el-icon>
          </div>
        </router-link>
      </div>
    </section>

    <!-- ---------- 平台特色与差异化展示（为什么选择 MindForge AI） ---------- -->
    <section class="ws__section ws__section--features">
      <div class="section__header">
        <div class="section__title-wrap">
          <div class="section__tag-row">
            <h2 class="section__title">为什么选择 MindForge AI？</h2>
            <span class="differentiator-badge">核心技术与差异化优势</span>
          </div>
          <span class="section__sub">
            对比传统求职招聘平台与泛通用 AI 助手，我们为技术求职者量身打造的四大专精能力
          </span>
        </div>
      </div>

      <div class="diff-grid">
        <div
          v-for="d in DIFFERENTIATORS"
          :key="d.title"
          class="diff-card mf-glass-card-interactive"
        >
          <div class="diff-card__head">
            <div class="diff-card__icon" :style="{ color: d.accentColor }">
              <el-icon><component :is="d.icon" /></el-icon>
            </div>
            <span
              class="diff-card__badge"
              :style="{ color: d.accentColor, borderColor: d.accentColor }"
            >
              {{ d.badge }}
            </span>
          </div>

          <h3 class="diff-card__title">{{ d.title }}</h3>

          <div class="diff-card__block diff-card__block--vs">
            <span class="diff-label diff-label--vs">传统工具 / 通用 AI 痛点</span>
            <p class="diff-text diff-text--vs">{{ d.vsTraditional }}</p>
          </div>

          <div class="diff-card__block diff-card__block--pro">
            <div class="diff-label diff-label--pro">
              <el-icon><CircleCheck /></el-icon>
              <span>MindForge 专属优势</span>
            </div>
            <p class="diff-text diff-text--pro">{{ d.mindforgeAdvantage }}</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ws {
  display: flex;
  flex-direction: column;
  gap: 36px;
  max-width: 1180px;
  margin: 0 auto;
  padding-bottom: 48px;
}

/* ---------- 顶部 Hero 区域 ---------- */
.ws__hero {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  justify-content: space-between;
  align-items: center;
  padding: 28px 32px;
  border-radius: var(--mf-radius-xl);
}

.ws__hero-left {
  flex: 1;
  min-width: 320px;
}

.ws__badge-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

.ws__pill {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 4px 12px;
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
  margin: 0 0 8px;
  font-size: var(--mf-font-xl);
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--mf-text-primary);
}

.ws__sub {
  margin: 0;
  font-size: var(--mf-font-sm);
  line-height: 1.65;
  color: var(--mf-text-secondary);
  max-width: 660px;
}

.ws__hero-tip {
  flex: none;
  width: 300px;
}

.tip-card {
  padding: 16px;
  background: var(--mf-glass-tint);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-md);
}

.tip-card__head {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 8px;
}

.tip-card__icon {
  font-size: var(--mf-font-sm);
  color: var(--mf-warning);
}

.tip-card__title {
  font-size: var(--mf-font-xs);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-warning-text);
  letter-spacing: 0.02em;
}

.tip-card__body {
  margin: 0;
  font-size: var(--mf-font-xs);
  line-height: 1.55;
  color: var(--mf-text-secondary);
}

/* ---------- 分区排版 ---------- */
.ws__section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.section__title-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section__tag-row {
  display: flex;
  gap: 12px;
  align-items: center;
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

.pipeline-badge,
.differentiator-badge {
  display: inline-flex;
  padding: 3px 12px;
  font-size: var(--mf-font-xs);
  font-weight: 500;
  color: var(--mf-primary-text);
  background-color: var(--mf-primary-subtle);
  border-radius: var(--mf-radius-pill);
}

.differentiator-badge {
  color: #af52de;
  background-color: rgb(175 82 222 / 12%);
}

/* ---------- 核心闭环 3 列卡片（增加缝隙与呼吸感） ---------- */
.pipeline-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px; /* 彻底修复间距过挤问题，留出充足缝隙 */
}

@media (width <= 960px) {
  .pipeline-grid {
    grid-template-columns: 1fr;
  }
}

.step-card {
  display: flex;
  flex-direction: column;
  padding: 24px 24px 20px;
  text-decoration: none;
  color: inherit;
  border-radius: var(--mf-radius-xl);
  min-height: 310px;
}

.step-card__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.step-card__badge {
  font-size: 15px;
  font-weight: 700;
  font-family: var(--mf-font-mono, monospace);
  color: var(--mf-text-tertiary);
  letter-spacing: 0.05em;
}

.step-card__tag {
  padding: 2px 10px;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-secondary);
  background-color: var(--mf-glass-tint-strong);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-pill);
}

.step-card__icon-box {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
  border-radius: var(--mf-radius-md);
  color: #fff;
  box-shadow: 0 8px 18px rgb(0 0 0 / 12%);
  transition: transform var(--mf-duration-fast) var(--mf-ease-spring);
}

.step-card:hover .step-card__icon-box {
  transform: scale(1.06);
}

.step-card__icon {
  font-size: 24px;
}

.step-card__content {
  flex: 1;
}

.step-card__title {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.step-card__desc {
  margin: 0 0 14px;
  font-size: var(--mf-font-xs);
  line-height: 1.6;
  color: var(--mf-text-secondary);
}

.step-card__highlights {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.step-card__highlights li {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--mf-text-tertiary);
}

.highlight-check {
  font-size: 12px;
  color: var(--mf-success);
}

.step-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--mf-glass-border-soft);
  font-size: var(--mf-font-xs);
  font-weight: 500;
  color: var(--mf-primary-text);
}

.step-card__arrow-circle {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  background-color: var(--mf-glass-tint-strong);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: 50%;
  transition:
    transform var(--mf-duration-fast) var(--mf-ease-spring),
    background-color var(--mf-duration-fast) var(--mf-ease-out);
}

.step-card:hover .step-card__arrow-circle {
  transform: translateX(4px);
  background-color: var(--mf-primary-subtle);
  color: var(--mf-primary-text);
}

/* ---------- 辅助工具网格（重构更精致） ---------- */
.tools-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

@media (width <= 960px) {
  .tools-grid {
    grid-template-columns: 1fr;
  }
}

.tool-card {
  display: flex;
  flex-direction: column;
  padding: 22px 20px 18px;
  text-decoration: none;
  color: inherit;
  border-radius: var(--mf-radius-lg);
  min-height: 200px;
}

.tool-card__header-row {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.tool-card__icon-wrap {
  display: grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  font-size: 22px;
  color: #fff;
  border-radius: var(--mf-radius-md);
  box-shadow: 0 6px 14px rgb(0 0 0 / 12%);
  transition: transform var(--mf-duration-fast) var(--mf-ease-spring);
}

.tool-card:hover .tool-card__icon-wrap {
  transform: scale(1.08) rotate(3deg);
}

.tool-card__title-meta {
  flex: 1;
  min-width: 0;
}

.tool-card__name-line {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.tool-card__title {
  font-size: 15px;
  font-weight: 600;
}

.tool-card__tag {
  padding: 1px 7px;
  font-size: 10px;
  color: var(--mf-text-secondary);
  background-color: var(--mf-glass-tint-strong);
  border-radius: var(--mf-radius-pill);
}

.tool-card__soon {
  padding: 1px 6px;
  font-size: 10px;
  color: var(--mf-warning-text);
  background-color: var(--mf-warning-subtle);
  border-radius: var(--mf-radius-pill);
}

.tool-card__desc {
  display: block;
  font-size: var(--mf-font-xs);
  line-height: 1.5;
  color: var(--mf-text-secondary);
}

.tool-card__features {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 10px 0 14px;
  padding: 10px 12px;
  background-color: var(--mf-glass-tint);
  border-radius: var(--mf-radius-sm);
  border: 1px solid var(--mf-glass-border-soft);
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--mf-text-tertiary);
}

.feature-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: var(--mf-primary);
}

.tool-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--mf-font-xs);
  font-weight: 500;
  color: var(--mf-primary-text);
}

.tool-card__btn {
  letter-spacing: 0.02em;
}

.tool-card__arrow {
  transition: transform var(--mf-duration-fast) var(--mf-ease-spring);
}

.tool-card:hover .tool-card__arrow {
  transform: translateX(4px);
}

/* ---------- 平台特色差异化网格（4 列横展） ---------- */
.diff-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}

@media (width <= 1040px) {
  .diff-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (width <= 640px) {
  .diff-grid {
    grid-template-columns: 1fr;
  }
}

.diff-card {
  display: flex;
  flex-direction: column;
  padding: 20px;
  border-radius: var(--mf-radius-lg);
}

.diff-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.diff-card__icon {
  font-size: 22px;
}

.diff-card__badge {
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid currentColor;
  border-radius: var(--mf-radius-pill);
}

.diff-card__title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.diff-card__block {
  padding: 10px 12px;
  border-radius: var(--mf-radius-sm);
  margin-bottom: 8px;
}

.diff-card__block--vs {
  background-color: var(--mf-glass-tint);
  border: 1px solid var(--mf-glass-border-soft);
}

.diff-card__block--pro {
  background-color: color-mix(in srgb, var(--mf-primary) 8%, var(--mf-glass-tint-strong));
  border: 1px solid color-mix(in srgb, var(--mf-primary) 24%, transparent);
}

.diff-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.diff-label--vs {
  color: var(--mf-text-tertiary);
}

.diff-label--pro {
  color: var(--mf-primary-text);
}

.diff-text {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
}

.diff-text--vs {
  color: var(--mf-text-tertiary);
  text-decoration: line-through;
  text-decoration-color: var(--mf-danger);
}

.diff-text--pro {
  color: var(--mf-text-secondary);
}
</style>
