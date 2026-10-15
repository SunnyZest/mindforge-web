<script setup lang="ts">
import {
  ArrowDown,
  Briefcase,
  ChatDotRound,
  Collection,
  Document,
  HomeFilled,
  Microphone,
  Moon,
  Sunny,
  Trophy,
  User,
} from '@element-plus/icons-vue'
import { computed, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const theme = useThemeStore()

/**
 * 图标按名字取。
 * 只 import 用到的那几个 —— `import * as Icons` 会把几百个图标全拉进来，
 * 而 `import *` 基本没法 tree-shake。
 *
 * ⚠️ 加了页面之后**记得来这里补图标** —— 路由里 `icon: 'Xxx'` 写了但这里没有，
 *    表现是「菜单项前面空着」，不会报错。详见下面的 iconOf()。
 */
const ICONS: Record<string, Component> = {
  HomeFilled,
  Document,
  Briefcase,
  Microphone,
  Collection,
  ChatDotRound,
  User,
  Trophy,
}

/**
 * 从路由 meta 取图标组件。
 *
 * ⚠️ 这个包装不是多余的：`ICONS[name]` 取不到时是 `undefined`，
 *    模板里 `v-if="m.icon"` 直接跳过 —— **图标静默消失，没有任何报错**。
 *    没人会想到「菜单前面空一格」是因为名字拼错了。
 *    所以开发环境显式报一条 error，一眼就能看到。
 *    （管理端的 AdminLayout 里有同一份，那边也踩过：`Key` 漏了没加。）
 */
function iconOf(name: string | undefined): Component | undefined {
  if (!name) return undefined

  const icon = ICONS[name]
  if (!icon && import.meta.env.DEV) {
    console.error(
      `[UserLayout] 菜单图标 "${name}" 不在 ICONS 映射表里，图标不会显示。` +
        ' 请到 @element-plus/icons-vue 里找同名图标并加进 ICONS。',
    )
  }
  return icon
}

/**
 * 顶部菜单：从路由表里挑出带 `title` 的子路由，再按权限过滤。
 *
 * 为什么不手写一份菜单数组：那样权限码要写两遍（路由一遍、菜单一遍），
 * 加页面时容易只改一处 —— 表现就是「地址栏能进，菜单里找不到」。
 */
const menus = computed(() =>
  router
    .getRoutes()
    .filter((r) => r.meta.title && r.name)
    .filter((r) => !r.meta.permission || auth.can(r.meta.permission))
    .sort((a, b) => (a.meta.order ?? 99) - (b.meta.order ?? 99))
    .map((r) => ({
      name: String(r.name),
      path: r.path,
      title: r.meta.title as string,
      icon: iconOf(r.meta.icon),
      comingSoon: Boolean(r.meta.comingSoon),
    })),
)

/**
 * 右上角用户菜单的命令分发。
 * ⚠️ 别把 @command 直接绑到 onLogout 上 —— 那样会忽略传进来的命令，
 *    将来加一项（比如「修改密码」）点它也会把人踢下线。
 */
async function onCommand(command: string): Promise<void> {
  if (command === 'logout') {
    await auth.logout()
    await router.replace({ name: 'login' })
  } else if (command === 'profile') {
    await router.push({ name: 'profile' })
  }
}
</script>

<template>
  <div class="layout">
    <!-- ★ Liquid Glass：顶栏是【玻璃层】—— 浮在内容之上，让背后的渐变透出来。
         玻璃配方（着色 / 模糊 / 无障碍降级）全交给共享的 .mf-glass--edge。
         ⚠️ 别在这儿手写 backdrop-filter —— 手写的那份会漏掉
            prefers-reduced-transparency 降级，无障碍就破了。 -->
    <header class="layout__bar mf-glass--edge">
      <div class="layout__brand">
        <span class="layout__logo">M</span>
        <span class="layout__name">MindForge</span>
      </div>

      <nav class="layout__nav">
        <router-link
          v-for="m in menus"
          :key="m.name"
          :to="m.path"
          class="nav__item"
          :class="{
            'nav__item--active': route.path === m.path,
            'nav__item--soon': m.comingSoon,
          }"
          :title="m.comingSoon ? `${m.title}（建设中）` : m.title"
        >
          <el-icon v-if="m.icon"><component :is="m.icon" /></el-icon>
          <span class="nav__text">{{ m.title }}</span>
          <!-- 未开放的挂一个小圆点，别让人以为是坏了 -->
          <span v-if="m.comingSoon" class="nav__dot" aria-hidden="true" />
        </router-link>
      </nav>

      <div class="layout__actions">
        <!-- 主题切换。图标显示的是「点了会切到哪个」，不是当前状态 ——
             moon 表示「切到深色」，这是这类按钮的通行约定。
             ★ 用原生 title 而不是 el-tooltip：省一个组件 chunk，
               而且加新 EP 组件会触发 Vite 重新优化依赖（助手沙箱里会崩）。 -->
        <button
          type="button"
          class="layout__icon-btn"
          :title="theme.isDark ? '切换到浅色主题' : '切换到深色主题'"
          :aria-label="theme.isDark ? '切换到浅色主题' : '切换到深色主题'"
          @click="theme.toggle()"
        >
          <el-icon><Moon v-if="!theme.isDark" /><Sunny v-else /></el-icon>
        </button>

        <el-dropdown @command="onCommand">
          <span class="layout__user">
            {{ auth.displayName || '未登录' }}
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">个人资料</el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <!-- 主区域保持透明 —— 卡片自己就是玻璃，浮在页面渐变上。
         ⚠️ 这里不能再刷一层实色底，否则整页玻璃全被盖住。 -->
    <main class="layout__main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.layout__bar {
  display: flex;
  flex: none;
  gap: var(--mf-space-6);
  align-items: center;
  height: 60px;
  padding: 0 var(--mf-space-6);
  border-bottom: 1px solid var(--mf-glass-border-soft);
}

/* ---------- 品牌 ---------- */
.layout__brand {
  display: flex;
  flex: none;
  gap: var(--mf-space-2);
  align-items: center;
}

/* 和 favicon 同一套视觉：品牌蓝渐变方章 */
.layout__logo {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  font-size: 15px;
  font-weight: var(--mf-weight-medium);
  color: #fff;
  background: linear-gradient(160deg, #4a9eff, #0071e3);
  border-radius: 8px;
}

.layout__name {
  font-size: var(--mf-font-lg);
  font-weight: var(--mf-weight-medium);
  letter-spacing: -0.02em;
}

/* ---------- 导航 ---------- */
.layout__nav {
  display: flex;
  flex: 1;
  gap: var(--mf-space-1);
  align-items: center;
  min-width: 0;
  overflow-x: auto;
  /* 横向滚动条在顶栏里很丑，而且鼠标用户不需要它 —— 滚轮/触摸板照样能滚 */
  scrollbar-width: none;
}

.layout__nav::-webkit-scrollbar {
  display: none;
}

.nav__item {
  position: relative;
  display: flex;
  flex: none;
  gap: var(--mf-space-1);
  align-items: center;
  padding: var(--mf-space-2) var(--mf-space-3);
  font-size: var(--mf-font-sm);
  color: var(--mf-text-secondary);
  text-decoration: none;
  border-radius: var(--mf-radius-pill);
  transition:
    background-color var(--mf-duration-fast) var(--mf-ease-out),
    color var(--mf-duration-fast) var(--mf-ease-out);
}

.nav__item:hover {
  background-color: var(--mf-glass-tint-strong);
  color: var(--mf-text-primary);
}

.nav__item--active {
  color: var(--mf-primary-text);
  background-color: var(--mf-primary-subtle);
}

/* 未开放的菜单项：压暗但仍可点（点进去是一页「建设中」的说明，
   比直接禁用更好 —— 禁用的项用户不知道是没做还是没权限） */
.nav__item--soon {
  color: var(--mf-text-tertiary);
}

.nav__dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 5px;
  height: 5px;
  background-color: var(--mf-warning);
  border-radius: 50%;
}

/* ---------- 右侧 ---------- */
.layout__actions {
  display: flex;
  flex: none;
  gap: var(--mf-space-2);
  align-items: center;
}

/* 圆形玻璃按钮。
   ⚠️ 尺寸写死 32px 是为了「点击热区 ≥ 32px」这个无障碍底线，不是为好看。 */
.layout__icon-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  font-size: var(--mf-font-md);
  color: var(--mf-text-secondary);
  cursor: pointer;
  background-color: var(--mf-glass-tint);
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-pill);
  transition:
    background-color var(--mf-duration-fast) var(--mf-ease-out),
    color var(--mf-duration-fast) var(--mf-ease-out),
    transform var(--mf-duration-fast) var(--mf-ease-spring);
}

.layout__icon-btn:hover {
  color: var(--mf-text-primary);
  background-color: var(--mf-glass-tint-strong);
}

.layout__icon-btn:active {
  transform: scale(0.92);
}

/* 键盘可达性：默认 focus ring 在玻璃上很糊，换主色描边 */
.layout__icon-btn:focus-visible {
  outline: 2px solid var(--mf-primary);
  outline-offset: 2px;
}

.layout__user {
  display: flex;
  gap: var(--mf-space-1);
  align-items: center;
  padding: var(--mf-space-1) var(--mf-space-3);
  color: var(--mf-text-secondary);
  cursor: pointer;
  border-radius: var(--mf-radius-pill);
  transition:
    background-color var(--mf-duration-fast) var(--mf-ease-out),
    color var(--mf-duration-fast) var(--mf-ease-out);
}

.layout__user:hover {
  color: var(--mf-text-primary);
  background-color: var(--mf-glass-tint-strong);
}

/* ---------- 主区域 ---------- */
.layout__main {
  flex: 1;
  min-height: 0;
  padding: var(--mf-space-6);
  overflow-y: auto;
  background-color: transparent;
}

/* 窄屏：隐藏导航文字只留图标，别让顶栏挤爆 */
@media (width <= 720px) {
  .nav__text {
    display: none;
  }

  .layout__name {
    display: none;
  }

  .layout__bar {
    gap: var(--mf-space-3);
    padding: 0 var(--mf-space-4);
  }
}
</style>
