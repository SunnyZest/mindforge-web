<script setup lang="ts">
import { ArrowDown, Brush, Moon, Odometer, Sunny, User } from '@element-plus/icons-vue'
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
 *
 * 只 import 用到的那几个，而不是 `import * as Icons from '@element-plus/icons-vue'` ——
 * 后者会把几百个图标全拉进来（`import *` 基本没法 tree-shake）。
 */
const ICONS: Record<string, Component> = { Odometer, User, Brush }

/**
 * 侧边栏菜单：从路由表里挑出带 `title` 的子路由，再按权限过滤。
 *
 * <b>为什么不手写一份菜单数组</b>：那样权限码要写两遍（路由里一遍、菜单里一遍），
 * 加页面时很容易只改一处 —— 表现就是「地址栏直接敲能进，但菜单里找不到」。
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
      icon: r.meta.icon ? ICONS[r.meta.icon] : undefined,
    })),
)

async function onLogout(): Promise<void> {
  await auth.logout()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <el-container class="layout">
    <el-aside width="220px" class="layout__aside mf-glass--edge">
      <div class="layout__brand">MindForge 管理后台</div>

      <el-menu :default-active="route.path" router class="layout__menu">
        <el-menu-item v-for="m in menus" :key="m.name" :index="m.path">
          <el-icon v-if="m.icon"><component :is="m.icon" /></el-icon>
          <span>{{ m.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="layout__header mf-glass--edge">
        <span class="layout__title">{{ route.meta.title ?? '' }}</span>

        <div class="layout__actions">
          <!-- 主题切换。图标显示的是「点了会切到哪个」，不是当前状态 ——
               moon 表示「切到深色」，这是这类按钮的通行约定。

               ★ 这里刻意用原生 title 而不是 <el-tooltip>：
                 一是省一个组件 chunk（图标按钮的提示用原生 title 足够），
                 二是加新 EP 组件会触发 Vite 重新优化依赖，
                 在助手沙箱里会撞上安全删除拦截、把 dev server 搞崩。 -->
          <button
            type="button"
            class="layout__theme"
            :title="theme.isDark ? '切换到浅色主题' : '切换到深色主题'"
            :aria-label="theme.isDark ? '切换到浅色主题' : '切换到深色主题'"
            @click="theme.toggle()"
          >
            <el-icon><Moon v-if="!theme.isDark" /><Sunny v-else /></el-icon>
          </button>

          <el-dropdown @command="onLogout">
            <span class="layout__user">
              {{ auth.user?.nickname || auth.user?.username || '未登录' }}
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="layout__main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout {
  height: 100%;
}

/* ★ Liquid Glass：侧边栏是【玻璃层】—— 浮在内容之上，让背后的渐变透出来。
   玻璃配方（着色 / 模糊 / 降级）全部交给共享的 .mf-glass--edge，
   这里只留布局相关的东西。
   ⚠️ 别在这儿手写 backdrop-filter —— 实测踩过：手写的那份会漏掉
      prefers-reduced-transparency 降级，无障碍就破了。 */
.layout__aside {
  border-right: 1px solid var(--mf-glass-border-soft);
}

.layout__brand {
  display: flex;
  align-items: center;
  height: 60px;
  padding: 0 var(--mf-space-6);
  font-weight: var(--mf-weight-medium);
  border-bottom: 1px solid var(--mf-glass-border-soft);
}

.layout__menu {
  border-right: none;
}

/* 顶栏同样是玻璃层，配方同样走 .mf-glass--edge */
.layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--mf-glass-border-soft);
}

.layout__title {
  font-size: var(--mf-font-lg);
  font-weight: var(--mf-weight-medium);
  letter-spacing: -0.02em;
}

.layout__actions {
  display: flex;
  align-items: center;
  gap: var(--mf-space-2);
}

/* 主题切换按钮：圆形玻璃按钮。
   ★ 它是「功能层」元素，所以用玻璃 + 轻微回弹，和用户区保持同一套语言。
   ⚠️ 尺寸写死 32px 是为了「点击热区 ≥ 32px」这个无障碍底线，
      不是因为好看 —— 别为了紧凑把它压小。 */
.layout__theme {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--mf-glass-border-soft);
  border-radius: var(--mf-radius-pill);
  background-color: var(--mf-glass-tint);
  color: var(--mf-text-secondary);
  font-size: var(--mf-font-md);
  cursor: pointer;
  transition:
    background-color var(--mf-duration-fast) var(--mf-ease-out),
    color var(--mf-duration-fast) var(--mf-ease-out),
    transform var(--mf-duration-fast) var(--mf-ease-spring);
}

.layout__theme:hover {
  background-color: var(--mf-glass-tint-strong);
  color: var(--mf-text-primary);
}

.layout__theme:active {
  transform: scale(0.92);
}

/* 键盘可达性：默认的 focus ring 在玻璃上很糊，换成主色描边 */
.layout__theme:focus-visible {
  outline: 2px solid var(--mf-primary);
  outline-offset: 2px;
}

/* 用户区做成胶囊按钮 —— 悬停有反馈，符合「功能层元素可交互」的暗示 */
.layout__user {
  display: flex;
  gap: var(--mf-space-1);
  align-items: center;
  padding: var(--mf-space-1) var(--mf-space-3);
  border-radius: var(--mf-radius-pill);
  color: var(--mf-text-secondary);
  cursor: pointer;
  transition:
    background-color var(--mf-duration-fast) var(--mf-ease-out),
    color var(--mf-duration-fast) var(--mf-ease-out);
}

.layout__user:hover {
  background-color: var(--mf-glass-tint-strong);
  color: var(--mf-text-primary);
}

/* 主区域保持透明 —— 卡片自己就是玻璃，浮在页面渐变上。
   ⚠️ 这里【不能】再刷一层实色底，否则整页玻璃全被盖住。 */
.layout__main {
  padding: var(--mf-space-6);
  background-color: transparent;
}
</style>
