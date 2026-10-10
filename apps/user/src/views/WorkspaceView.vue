<script setup lang="ts">
import {
  Briefcase,
  ChatDotRound,
  Collection,
  Document,
  Microphone,
  User,
} from '@element-plus/icons-vue'
import { computed, type Component } from 'vue'

import type { Permission } from '@mindforge/shared'

import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

/**
 * 功能入口。
 *
 * ⚠️ 这里手写数组是**刻意的**（和管理端「菜单从路由表生成」的做法相反）：
 *    工作台的入口卡片不是导航，它要带副标题、要能排序、将来还要带「未读/待办」角标。
 *    从路由 meta 生成的话，这些都得塞进 meta，反而更绕。
 *    代价是新增功能时这里要记得加一张卡 —— 所以下面用 `comingSoon` 显式标出状态。
 */
interface Entry {
  title: string
  desc: string
  icon: Component
  to: string
  permission?: Permission
  comingSoon?: boolean
}

const ENTRIES: Entry[] = [
  {
    title: '我的简历',
    desc: '上传简历，看 AI 给出的逐条优化建议',
    icon: Document,
    to: '/resumes',
    permission: 'app:resume:read',
  },
  {
    title: '目标职位',
    desc: '录入 JD，让 AI 解析出岗位真正看重什么',
    icon: Briefcase,
    to: '/jobs',
    permission: 'app:job:read',
    comingSoon: true,
  },
  {
    title: '模拟面试',
    desc: '按简历和岗位出题，答完给逐题点评',
    icon: Microphone,
    to: '/interviews',
    permission: 'app:interview:read',
    comingSoon: true,
  },
  {
    title: '知识库',
    desc: '上传资料，问答时引用原文出处',
    icon: Collection,
    to: '/knowledge',
    permission: 'app:knowledge:read',
    comingSoon: true,
  },
  {
    title: 'AI 问答',
    desc: '基于你的资料提问，答案带引用溯源',
    icon: ChatDotRound,
    to: '/chat',
    permission: 'app:rag:search',
    comingSoon: true,
  },
  {
    title: '个人资料',
    desc: '改昵称、头像和密码',
    icon: User,
    to: '/profile',
  },
]

/** 按权限过滤 —— 没权限的入口不显示（后端才是真防线，这里只是 UX） */
const entries = computed(() => ENTRIES.filter((e) => !e.permission || auth.can(e.permission)))

/** 按时间段问候 —— 细节，但让人感觉这产品是活的 */
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
    <header class="ws__hero">
      <h1 class="ws__hello">{{ greeting }}，{{ auth.displayName }}</h1>
      <p class="ws__sub">从下面选一件事开始 —— 简历和岗位录进来之后，面试和问答才有东西可依。</p>
    </header>

    <div class="ws__grid">
      <router-link v-for="e in entries" :key="e.title" :to="e.to" class="entry">
        <span class="entry__icon">
          <el-icon><component :is="e.icon" /></el-icon>
        </span>

        <div class="entry__main">
          <div class="entry__head">
            <span class="entry__title">{{ e.title }}</span>
            <!-- 未开放的要【明说】，别让人点进去以为坏了 -->
            <span v-if="e.comingSoon" class="entry__badge">建设中</span>
          </div>
          <p class="entry__desc">{{ e.desc }}</p>
        </div>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.ws {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-6);
  max-width: 1080px;
  margin: 0 auto;
}

.ws__hello {
  margin: 0 0 var(--mf-space-2);
  font-size: var(--mf-font-2xl);
  font-weight: var(--mf-weight-medium);
  letter-spacing: -0.02em;
}

.ws__sub {
  margin: 0;
  color: var(--mf-text-secondary);
}

/* 自适应列数 —— 不写死 3 列，窄屏自己降到 2 / 1 列 */
.ws__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--mf-space-4);
}

.entry {
  display: flex;
  gap: var(--mf-space-4);
  align-items: flex-start;
  padding: var(--mf-space-5);
  color: inherit;
  text-decoration: none;
  background-color: var(--mf-glass-card);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-lg);
  transition:
    transform var(--mf-duration-fast) var(--mf-ease-spring),
    border-color var(--mf-duration-fast) var(--mf-ease-out),
    background-color var(--mf-duration-fast) var(--mf-ease-out);
}

.entry:hover {
  background-color: var(--mf-glass-tint-strong);
  border-color: var(--mf-primary);
  transform: translateY(-2px);
}

/* 键盘可达性：默认 focus ring 在玻璃上很糊 */
.entry:focus-visible {
  outline: 2px solid var(--mf-primary);
  outline-offset: 2px;
}

.entry__icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 40px;
  height: 40px;
  font-size: var(--mf-font-lg);
  color: var(--mf-primary-text);
  background-color: var(--mf-primary-subtle);
  border-radius: var(--mf-radius-md);
}

.entry__main {
  min-width: 0;
}

.entry__head {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
}

.entry__title {
  font-weight: var(--mf-weight-medium);
}

.entry__badge {
  padding: 0 var(--mf-space-2);
  font-size: var(--mf-font-xs);
  color: var(--mf-warning-text);
  background-color: var(--mf-warning-subtle);
  border-radius: var(--mf-radius-pill);
}

.entry__desc {
  margin: var(--mf-space-1) 0 0;
  font-size: var(--mf-font-sm);
  line-height: 1.6;
  color: var(--mf-text-tertiary);
}
</style>
