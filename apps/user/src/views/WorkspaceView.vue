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
  DataAnalysis,
  Document,
  EditPen,
  Lightning,
  Lock,
  Microphone,
  Promotion,
  Star,
  TrendCharts,
  Trophy,
  User,
} from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref, type Component } from 'vue'

import type { Permission } from '@mindforge/shared'

import { interviewApi } from '@/api/interview'
import { jobApi } from '@/api/job'
import { resumeApi } from '@/api/resume'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

/* ========== 实时仪表盘 ========== */

const statsLoading = ref(true)
const stats = reactive({
  resumeCount: 0,
  totalTracked: 0,
  appliedCount: 0,
  interviewingCount: 0,
  offerCount: 0,
  upcomingScheduleCount: 0,
  totalAnswered: 0,
  weakCount: 0,
  masteredCount: 0,
  averageScore: null as number | null,
})

onMounted(async () => {
  try {
    const tasks: Promise<unknown>[] = [
      auth.can('app:resume:read')
        ? resumeApi.page({ page: 1, pageSize: 1 }).then((r) => {
            stats.resumeCount = r.total
          })
        : Promise.resolve(),
      auth.can('app:job:read')
        ? jobApi.kanbanStats().then((r) => {
            stats.totalTracked = r.totalTracked
            stats.appliedCount = r.appliedCount
            stats.interviewingCount = r.interviewingCount
            stats.offerCount = r.offerCount
            stats.upcomingScheduleCount = r.upcomingScheduleCount
          })
        : Promise.resolve(),
      auth.can('app:interview:read')
        ? interviewApi.mistakeStats().then((r) => {
            stats.totalAnswered = r.totalAnswered
            stats.weakCount = r.weakCount
            stats.masteredCount = r.masteredCount
            stats.averageScore = r.averageScore
          })
        : Promise.resolve(),
    ]
    await Promise.allSettled(tasks)
  } catch {
    /* 仪表盘统计为辅助信息，加载失败静默忽略 */
  } finally {
    statsLoading.value = false
  }
})

interface MetricCard {
  label: string
  icon: Component
  color: string
  /** stats 中的 key */
  key: keyof typeof stats
  /** 附加单位 */
  suffix?: string
  /**
   * 点击卡片跳去哪（整卡是 router-link —— 和新手引导/流程卡片一个做法，
   * 键盘导航、中键新标签页打开都是免费的）。
   *
   * ⚠️ 「已获 Offer」跳【看板】而不是 /offers：卡片数字来自看板 stats
   *    （投递进度推进到 OFFER 阶段的职位数），跳 /offers 会和数字对不上。
   *    /offers 的入口放在看板 OFFER 列的「去对比」按钮上（见 JobKanbanBoard）。
   */
  to: string
  /** 没有这个权限就不渲染这张卡 —— 没权限时后端也没数据，亮一个 0 很误导 */
  permission: Permission
}

const METRICS: MetricCard[] = [
  {
    label: '我的简历',
    icon: Document,
    color: '#007aff',
    key: 'resumeCount',
    to: '/resumes',
    permission: 'app:resume:read',
  },
  {
    label: '追踪职位',
    icon: Briefcase,
    color: '#5856d6',
    key: 'totalTracked',
    to: '/jobs?view=kanban',
    permission: 'app:job:read',
  },
  {
    label: '投递进行',
    icon: Promotion,
    color: '#30b0c7',
    key: 'appliedCount',
    to: '/jobs?view=kanban',
    permission: 'app:job:read',
  },
  {
    label: '面试进行',
    icon: Microphone,
    color: '#ff9500',
    key: 'interviewingCount',
    to: '/interviews',
    permission: 'app:interview:read',
  },
  {
    label: '已获 Offer',
    icon: Trophy,
    color: '#34c759',
    key: 'offerCount',
    to: '/jobs?view=kanban',
    permission: 'app:job:read',
  },
  {
    // ★ 带 ?view=mistakes：InterviewListView 读到就直接展开错题本，
    //   不用用户落地后再点一次「错题本与薄弱点重练」
    label: '待攻克错题',
    icon: TrendCharts,
    color: '#ff2d55',
    key: 'weakCount',
    to: '/interviews?view=mistakes',
    permission: 'app:interview:read',
  },
]

/** 按权限过滤后的卡片 —— 没权限的卡连渲染都不渲染 */
const visibleMetrics = computed(() => METRICS.filter((m) => auth.can(m.permission)))

/**
 * 一个数据都没有（新用户）。
 *
 * ⚠️ 只按「有权限且统计为 0/null」判全空 —— 新用户进来看到一排 0 是浪费首屏，
 * 换成引导卡给他一个明确的第一步。有一条数据就恢复正常网格。
 */
const isEmptyStats = computed(() =>
  visibleMetrics.value.every((m) => !stats[m.key]),
)

/* ========== 核心求职链路 ========== */

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

const FLOW_STEPS: FlowStep[] = [
  {
    step: '01',
    title: '简历中心',
    tag: '基础底座 · AI 精修',
    desc: '深度解析 PDF / Word 简历，AI 逐段精修建议一键采纳，支持 A4 排版 PDF 导出求职级简历。',
    highlights: [
      '结构化信息智能提取',
      'AI 逐段量化改写建议',
      '一键采纳实时更新',
      'A4 排版 PDF 简历导出',
    ],
    icon: Document,
    to: '/resumes',
    permission: 'app:resume:read',
    accentColor: 'linear-gradient(135deg, #007aff, #00c6ff)',
  },
  {
    step: '02',
    title: '目标职位 & 投递看板',
    tag: '需求拆解 · CRM 追踪',
    desc: '一键录入 JD 智能提炼考核画像，8 阶段全流程投递看板 CRM，日程提醒与跟进备注一应俱全。',
    highlights: [
      '硬技能权重提取 & 匹配诊断',
      '8 阶段泳道看板 CRM',
      '一键推进阶段流转',
      '日程倒计时 & 跟进备注',
    ],
    icon: Briefcase,
    to: '/jobs',
    permission: 'app:job:read',
    accentColor: 'linear-gradient(135deg, #5856d6, #af52de)',
  },
  {
    step: '03',
    title: '模拟面试 & 错题复盘',
    tag: '实战演练 · 闭环复盘',
    desc: '结合简历与 JD 交叉出题，多轮追问拟真压力面；面试错题智能归集，薄弱点单题重练直到掌握。',
    highlights: [
      '简历-JD 交叉真题命制',
      '多轮动态深度追问',
      '五维能力雷达评分报告',
      '错题本薄弱点重练刷分',
    ],
    icon: Microphone,
    to: '/interviews',
    permission: 'app:interview:read',
    accentColor: 'linear-gradient(135deg, #ff9500, #ff2d55)',
  },
]

/* ========== 三大新功能亮点 ========== */

interface FeatureSpotlight {
  title: string
  subtitle: string
  desc: string
  tags: string[]
  icon: Component
  to: string
  permission?: Permission
  accentColor: string
  gradient: string
}

const FEATURE_SPOTLIGHTS: FeatureSpotlight[] = [
  {
    title: '简历 AI 精修工作室',
    subtitle: '一键采纳 · PDF 导出',
    desc: 'AI 逐段分析简历内容生成量化改写建议，一键采纳后实时更新预览，最终以 A4 专业排版导出求职级 PDF 简历。',
    tags: ['AI 逐段精修', '一键采纳改写', '实时预览', 'A4 PDF 导出'],
    icon: EditPen,
    to: '/resumes',
    permission: 'app:resume:read',
    accentColor: '#007aff',
    gradient: 'linear-gradient(135deg, #007aff, #00c6ff)',
  },
  {
    title: '求职投递看板 CRM',
    subtitle: '8 阶段全流程管控',
    desc: '从心愿清单到 Offer 收割的 8 阶段泳道式看板，实时推进投递阶段、绑定简历匹配、日程倒计时与 CRM 跟进备注。',
    tags: ['8 阶段泳道', '一键推进', '日程倒计时', 'CRM 跟进'],
    icon: DataAnalysis,
    to: '/jobs',
    permission: 'app:job:read',
    accentColor: '#5856d6',
    gradient: 'linear-gradient(135deg, #5856d6, #af52de)',
  },
  {
    title: '面试错题本 & 薄弱点重练',
    subtitle: '闭环复盘 · 刷分进阶',
    desc: 'AI 智能归集每场模拟面试的失分题，按知识领域标注薄弱分类，支持单题重练刷分直到完全掌握。',
    tags: ['错题自动归集', '薄弱点分类', '单题重练', '刷分进阶'],
    icon: TrendCharts,
    to: '/interviews',
    permission: 'app:interview:read',
    accentColor: '#ff9500',
    gradient: 'linear-gradient(135deg, #ff9500, #ff2d55)',
  },
]

const visibleSpotlights = computed(() =>
  FEATURE_SPOTLIGHTS.filter((f) => !f.permission || auth.can(f.permission)),
)

/* ========== 辅助中枢工具 ========== */

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

const TOOLS: ToolEntry[] = [
  {
    title: '知识库中枢',
    tag: '私域资产',
    desc: '上传专属技术笔记、面经真题与公司业务资料，毫秒级向量化切片沉淀为私域知识图谱。',
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
    desc: '基于你的专属知识库发起对话，每一条回答精准溯源到原文段落与引用依据，拒绝幻觉。',
    features: ['融合混合向量与全文检索', '拒绝模型幻觉 · 段落级可信溯源'],
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

/* ========== 平台核心优势 ========== */

interface Differentiator {
  icon: Component
  badge: string
  title: string
  vsTraditional: string
  mindforgeAdvantage: string
  accentColor: string
}

const DIFFERENTIATORS: Differentiator[] = [
  {
    icon: Lightning,
    badge: '闭环飞轮',
    title: '从割裂准备到全链路闭环',
    vsTraditional: '传统求职平台或普通改简历工具只做单点，简历、职位要求与面试题目完全脱节。',
    mindforgeAdvantage:
      'MindForge 将简历优化、JD 解析、投递管控与模拟面试紧密串联，以目标岗位为导向持续迭代求职能力，形成闭环飞轮。',
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
    icon: TrendCharts,
    badge: '闭环复盘',
    title: '错题本驱动薄弱点精准攻克',
    vsTraditional: '传统刷题平台千人一面推题，面试完没有错题归集，不知道哪里薄弱、无法精准补强。',
    mindforgeAdvantage:
      'AI 自动归集每场面试失分题，按知识分类标注薄弱点，支持单题重练并追踪刷分进阶轨迹，真正做到面试复盘闭环。',
    accentColor: '#ff2d55',
  },
  {
    icon: EditPen,
    badge: '一键精修',
    title: 'AI 简历精修 + 专业 PDF 导出',
    vsTraditional: '自己改简历没方向，花钱找人改等几天才反馈一版，来回沟通效率极低且不可控。',
    mindforgeAdvantage:
      'AI 逐段生成量化改写建议，一键采纳实时更新，所见即所得预览后 A4 排版 PDF 一键导出，秒级完成简历精修全流程。',
    accentColor: '#ff9500',
  },
  {
    icon: Lock,
    badge: '隐私沙箱',
    title: '求职资产私有隔离与数据零泄露',
    vsTraditional: '传统招聘工具或公开 AI 会将你的简历、经历沉淀为公开训练数据，求职意向存在向现公司或第三方泄露的风险。',
    mindforgeAdvantage:
      '个人简历、意向 JD 与问答面经全程处于专属隔离沙箱中，严格遵循企业级私有加密存储，绝不参与公网模型训练，坚决守护求职隐私。',
    accentColor: '#636366',
  },
]

/* ========== 可见性过滤 ========== */

const visibleFlowSteps = computed(() =>
  FLOW_STEPS.filter((s) => !s.permission || auth.can(s.permission)),
)

const visibleTools = computed(() => TOOLS.filter((t) => !t.permission || auth.can(t.permission)))

/* ========== 问候语 ========== */

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
    <!-- ========== 顶部仪表控制台 ========== -->
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
          新一代沉浸式 AI 求职备战中枢。从简历精修到投递管控、从模拟面试到错题复盘，构建「简历打磨 ➔
          投递追踪 ➔ 实战模拟 ➔ 闭环复盘」的全链路求职能力壁垒。
        </p>
      </div>

      <div class="ws__hero-tip">
        <div class="tip-card">
          <div class="tip-card__head">
            <el-icon class="tip-card__icon"><Star /></el-icon>
            <span class="tip-card__title">高效通关建议</span>
          </div>
          <p class="tip-card__body">
            建议先上传简历并录入目标 JD，AI
            将自动完成匹配诊断并基于交集精准出题。面试后的错题会自动归入错题本，随时刷分攻克薄弱点。
          </p>
        </div>
      </div>
    </header>

    <!-- ========== 平台特色与差异化展示 ========== -->
    <section class="ws__section ws__section--features">
      <div class="section__header">
        <div class="section__title-wrap">
          <div class="section__tag-row">
            <h2 class="section__title">为什么选择 MindForge AI？</h2>
            <span class="differentiator-badge">核心技术与差异化优势</span>
          </div>
          <span class="section__sub">
            对比传统求职招聘平台与泛通用 AI 助手，我们为技术求职者量身打造的六大专精能力
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
    <!-- ========== 实时数据仪表盘 ========== -->
    <section class="ws__section">
      <div class="section__header">
        <div class="section__title-wrap">
          <div class="section__tag-row">
            <h2 class="section__title">数据总览</h2>
            <span class="pipeline-badge">实时统计</span>
          </div>
          <span class="section__sub">你的求职进展一目了然，数据实时同步更新</span>
        </div>
      </div>

      <!--
        ★ 条件渲染：全 0（新用户）显示【引导卡】，否则显示数字卡网格。
        新用户进来看到一排 0 是浪费首屏 —— 给他一个明确的第一步动作。
      -->
      <div v-loading="statsLoading" class="metrics-body">
        <router-link
          v-if="!statsLoading && isEmptyStats"
          to="/resumes"
          class="metrics-empty mf-glass-card-interactive"
        >
          <div class="metrics-empty__icon">
            <el-icon><Document /></el-icon>
          </div>
          <div class="metrics-empty__text">
            <h3 class="metrics-empty__title">从第一份简历开始</h3>
            <p class="metrics-empty__desc">
              上传简历并录入目标 JD，AI 会自动完成匹配诊断、针对性出题 ——
              之后这里的数字会跟着你的求职进展实时动起来。
            </p>
          </div>
          <!--
            整张卡就是链接，这里只是「可以点」的视觉信号。
            刻意不放真 button —— <a> 里嵌 <button> 是非法嵌套，
            键盘 Tab 和读屏会把它当成两个独立焦点，重复播报。
          -->
          <span class="metrics-empty__cta">
            上传第一份简历
            <el-icon><ArrowRight /></el-icon>
          </span>
        </router-link>

        <!--
          ★ 有数据时用【统计条】而不是卡片网格：数字需要一眼扫过，横向紧凑条比
          六张卡片轻得多，也能和后面几块卡片网格拉开形态差异（打破节奏重复）。
        -->
        <div v-else-if="!statsLoading" class="stats-strip">
          <router-link
            v-for="m in visibleMetrics"
            :key="m.key"
            :to="m.to"
            class="stats-cell"
          >
            <span class="stats-cell__value" :style="{ color: m.color }">
              {{ stats[m.key] ?? 0 }}<em v-if="m.suffix" class="metric-card__suffix">{{ m.suffix }}</em>
            </span>
            <span class="stats-cell__label">
              <el-icon><component :is="m.icon" /></el-icon>
              {{ m.label }}
            </span>
          </router-link>
        </div>
      </div>
    </section>

    <!-- ========== 核心流程 3 步闭环 ========== -->
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

    <!-- ========== 三大新功能亮点 ========== -->
    <section v-if="visibleSpotlights.length" class="ws__section">
      <div class="section__header">
        <div class="section__title-wrap">
          <div class="section__tag-row">
            <h2 class="section__title">新功能亮点</h2>
            <span class="spotlight-badge">全新上线</span>
          </div>
          <span class="section__sub">
            三大重磅能力，覆盖简历精修、投递管控与面试复盘全场景
          </span>
        </div>
      </div>

      <div class="spotlight-grid">
        <router-link
          v-for="f in visibleSpotlights"
          :key="f.title"
          :to="f.to"
          class="spotlight-card mf-glass-card-interactive"
        >
          <div class="spotlight-card__left">
            <div class="spotlight-card__icon-wrap" :style="{ background: f.gradient }">
              <el-icon><component :is="f.icon" /></el-icon>
            </div>
          </div>

          <div class="spotlight-card__body">
            <div class="spotlight-card__head">
              <h3 class="spotlight-card__title">{{ f.title }}</h3>
              <span class="spotlight-card__subtitle">{{ f.subtitle }}</span>
            </div>
            <p class="spotlight-card__desc">{{ f.desc }}</p>
            <div class="spotlight-card__tags">
              <span v-for="t in f.tags" :key="t" class="spotlight-tag" :style="{ color: f.accentColor, borderColor: f.accentColor }">
                {{ t }}
              </span>
            </div>
          </div>

          <div class="spotlight-card__arrow">
            <el-icon><ArrowRight /></el-icon>
          </div>
        </router-link>
      </div>
    </section>

    <!-- ========== 辅助智囊与知识中枢 ========== -->
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

/* ---------- 实时数据仪表盘 ---------- */
.metrics-body {
  /* 固定最小高度：加载态与内容态之间不跳动 */
  min-height: 84px;
}

/*
  ★ 空态引导卡（新用户全 0 时）。
  之前只有模板没有样式，几个块级元素直接裸堆在一起 —— 卡片形同没写。
*/
.metrics-empty {
  display: flex;
  gap: 18px;
  align-items: center;
  padding: 20px 24px;
  color: inherit;
  text-decoration: none;
}

.metrics-empty__icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 52px;
  height: 52px;
  font-size: 24px;
  color: #fff;
  background: linear-gradient(135deg, var(--mf-primary), #5856d6);
  border-radius: var(--mf-radius-md);
  box-shadow: 0 6px 16px rgb(0 122 255 / 28%);
}

.metrics-empty__text {
  /* min-width: 0 让长文案在 flex 里换行，而不是把右侧 CTA 挤出卡片 */
  min-width: 0;
}

.metrics-empty__title {
  margin: 0 0 4px;
  font-size: var(--mf-font-lg);
  font-weight: 600;
  color: var(--mf-text-primary);
}

.metrics-empty__desc {
  margin: 0;
  font-size: var(--mf-font-sm);
  line-height: 1.55;
  color: var(--mf-text-secondary);
}

.metrics-empty__cta {
  display: inline-flex;
  flex: none;
  gap: 4px;
  align-items: center;
  margin-left: auto;
  padding: 9px 18px;
  font-size: var(--mf-font-sm);
  font-weight: 500;
  color: #fff;
  background: var(--mf-primary);
  border-radius: var(--mf-radius-pill);
  transition:
    background-color var(--mf-duration-fast) var(--mf-ease-out),
    transform var(--mf-duration-fast) var(--mf-ease-spring);
}

.metrics-empty:hover .metrics-empty__cta {
  transform: translateX(2px);
  background: var(--mf-primary-hover);
}

/* 窄屏：文字与 CTA 竖排，CTA 撑满一行（手指点得到） */
@media (width <= 720px) {
  .metrics-empty {
    flex-wrap: wrap;
    padding: 18px;
  }

  .metrics-empty__cta {
    justify-content: center;
    width: 100%;
    margin-left: 0;
  }
}

/* ---------- 实时数据仪表盘（统计条） ---------- */
.stats-strip {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
  overflow: hidden;
}

@media (width <= 1040px) {
  .stats-strip {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (width <= 640px) {
  .stats-strip {
    grid-template-columns: repeat(2, 1fr);
  }
}

.stats-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 10px;
  text-align: center;
  text-decoration: none;
  color: inherit;
  /* 相邻格子的分隔线 —— 窄屏下两列时最后一列会贴边，但视觉可接受 */
  border-right: 1px solid var(--mf-glass-border-soft);
  transition: background-color var(--mf-duration-fast) var(--mf-ease-out);
}

.stats-cell:hover {
  background-color: var(--mf-bg-subtle);
}

.stats-cell:nth-child(6n) {
  border-right: none;
}

.stats-cell__value {
  font-size: var(--mf-font-xl);
  font-weight: 700;
  letter-spacing: -0.03em;
  font-family: var(--mf-font-mono, monospace);
  line-height: 1.1;
}

.stats-cell__label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

/* 「这张卡可以点」的暗示 */
.metric-card__arrow {
  margin-left: auto;
  flex: none;
  color: var(--mf-text-tertiary);
  transition:
    transform var(--mf-duration-fast) var(--mf-ease-spring),
    color var(--mf-duration-fast) var(--mf-ease-out);
}

.metric-card:hover .metric-card__arrow {
  transform: translateX(3px);
  color: var(--mf-text-primary);
}

.metric-card__suffix {
  font-style: normal;
  font-size: var(--mf-font-xs);
  font-weight: 400;
  color: var(--mf-text-tertiary);
  margin-left: 2px;
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
.differentiator-badge,
.spotlight-badge {
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

.spotlight-badge {
  color: #ff9500;
  background-color: rgb(255 149 0 / 12%);
}

/* ---------- 核心闭环 3 列卡片 ---------- */
.pipeline-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
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
  min-height: 340px;
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

/* ---------- 三大新功能亮点 ---------- */
.spotlight-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.spotlight-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 22px 24px;
  text-decoration: none;
  color: inherit;
  border-radius: var(--mf-radius-xl);
  transition: transform var(--mf-duration-fast) var(--mf-ease-spring);
}

.spotlight-card:hover {
  transform: translateY(-2px);
}

.spotlight-card__left {
  flex: none;
}

.spotlight-card__icon-wrap {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  font-size: 26px;
  color: #fff;
  border-radius: var(--mf-radius-lg);
  box-shadow: 0 8px 20px rgb(0 0 0 / 15%);
  transition: transform var(--mf-duration-fast) var(--mf-ease-spring);
}

.spotlight-card:hover .spotlight-card__icon-wrap {
  transform: scale(1.08) rotate(3deg);
}

.spotlight-card__body {
  flex: 1;
  min-width: 0;
}

.spotlight-card__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.spotlight-card__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.spotlight-card__subtitle {
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 500;
  color: var(--mf-text-secondary);
  background-color: var(--mf-glass-tint-strong);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-pill);
}

.spotlight-card__desc {
  margin: 0 0 10px;
  font-size: var(--mf-font-xs);
  line-height: 1.55;
  color: var(--mf-text-secondary);
}

.spotlight-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.spotlight-tag {
  padding: 2px 10px;
  font-size: 10px;
  font-weight: 500;
  border: 1px solid;
  border-radius: var(--mf-radius-pill);
}

.spotlight-card__arrow {
  flex: none;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  font-size: 16px;
  color: var(--mf-text-tertiary);
  background-color: var(--mf-glass-tint-strong);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: 50%;
  transition:
    transform var(--mf-duration-fast) var(--mf-ease-spring),
    color var(--mf-duration-fast) var(--mf-ease-out);
}

.spotlight-card:hover .spotlight-card__arrow {
  transform: translateX(4px);
  color: var(--mf-primary-text);
}

/* ---------- 辅助工具网格 ---------- */
.tools-grid {
  display: grid;
  /* 2 列：和优势区（3 列）、核心链路（3 卡）区分开 —— 全页都是 3 列网格会很单调 */
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

@media (width <= 1040px) {
  .tools-grid {
    grid-template-columns: 1fr;
  }
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

/* ---------- 平台特色差异化网格（3x2 布局） ---------- */
.diff-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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
  /* 统一卡片高度：clamp 只限最大行数，短文案的卡还是矮 —— 再补一个 3 行的最小高度 */
  min-height: calc(3 * 1.5em);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
