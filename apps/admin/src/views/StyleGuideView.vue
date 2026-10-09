<script setup lang="ts">
import StatusTag from '@/components/StatusTag.vue'

/**
 * 设计规范页（开发用）。
 *
 * 作用：把设计 token 摊开给人看 —— 定规则的时候最容易出问题的是
 * 「说好了一套规则，但没人看得见」，写页面时就各凭感觉。
 * 有了这一页，改 token 前先来这看看影响面。
 *
 * ★ 色板不写死色值，而是直接用 var(--mf-xxx)：
 *   这样它显示的【永远是 CSS 里真实的值】，不会出现「文档和代码不一致」。
 *   深浅两套通过 data-theme 属性切换 —— 变量挂在 [data-theme='dark'] 上。
 */

const BG = ['bg-page', 'bg-surface', 'bg-subtle', 'bg-hover'] as const
const TEXT = ['text-primary', 'text-secondary', 'text-tertiary'] as const
const BORDER = ['border', 'border-strong'] as const
const BRAND = ['primary', 'primary-hover', 'primary-subtle', 'primary-text'] as const
const STATUS = ['success', 'warning', 'danger', 'info'] as const

const SPACES = [1, 2, 3, 4, 6, 8] as const
const RADII = ['sm', 'md', 'lg', 'pill'] as const
const FONTS = ['xs', 'sm', 'md', 'lg', 'xl'] as const

const THEMES = [
  { key: 'light', label: '浅色 · 管理端' },
  { key: 'dark', label: '深色 · 用户端' },
] as const
</script>

<template>
  <div class="guide">
    <el-card shadow="never">
      <h2 class="guide__h2">颜色</h2>
      <p class="guide__hint">
        变量名是<b>语义</b>的（bg-surface / text-secondary），不是外观的（gray-100）。
        深色主题只换值、不换名，页面里写一次就两边通用。
      </p>

      <div class="themes">
        <section v-for="t in THEMES" :key="t.key" :data-theme="t.key" class="theme">
          <h3 class="guide__h3">{{ t.label }}</h3>

          <p class="guide__label">底色层级</p>
          <div class="swatches">
            <div v-for="n in BG" :key="n" class="swatch">
              <div class="swatch__chip" :style="{ background: `var(--mf-${n})` }" />
              <span class="swatch__name">{{ n }}</span>
            </div>
          </div>

          <p class="guide__label">文字</p>
          <div class="swatches">
            <div v-for="n in TEXT" :key="n" class="swatch">
              <div class="swatch__chip" :style="{ background: `var(--mf-${n})` }" />
              <span class="swatch__name">{{ n }}</span>
            </div>
          </div>

          <p class="guide__label">边框</p>
          <div class="swatches">
            <div v-for="n in BORDER" :key="n" class="swatch">
              <div class="swatch__chip" :style="{ background: `var(--mf-${n})` }" />
              <span class="swatch__name">{{ n }}</span>
            </div>
          </div>

          <p class="guide__label">品牌色</p>
          <div class="swatches">
            <div v-for="n in BRAND" :key="n" class="swatch">
              <div class="swatch__chip" :style="{ background: `var(--mf-${n})` }" />
              <span class="swatch__name">{{ n }}</span>
            </div>
          </div>

          <p class="guide__label">状态色（原始色值）</p>
          <div class="swatches">
            <div v-for="n in STATUS" :key="n" class="swatch">
              <div class="swatch__chip" :style="{ background: `var(--mf-${n})` }" />
              <span class="swatch__name">{{ n }}</span>
            </div>
          </div>

          <p class="guide__label">状态标签（实际长这样）</p>
          <div class="tags">
            <StatusTag tone="success">启用</StatusTag>
            <StatusTag tone="warning">处理中</StatusTag>
            <StatusTag tone="danger">失败</StatusTag>
            <StatusTag tone="info">已解析</StatusTag>
            <StatusTag tone="neutral">未开始</StatusTag>
          </div>

          <p class="guide__label">组件样例</p>
          <div class="samples">
            <el-button type="primary">主要按钮</el-button>
            <el-button>次要按钮</el-button>
            <el-input placeholder="输入框" class="samples__input" />
          </div>
        </section>
      </div>
    </el-card>

    <el-card shadow="never" class="guide__card">
      <h2 class="guide__h2">间距 / 圆角 / 字号</h2>
      <p class="guide__hint">
        间距只有 4 的倍数这几档。别临时拍一个 10px / 14px ——
        间距一旦不成体系，页面看起来就是「没对齐」，但很难指出是哪不对。
      </p>

      <p class="guide__label">间距</p>
      <div class="spaces">
        <div v-for="s in SPACES" :key="s" class="space">
          <div class="space__bar" :style="{ width: `var(--mf-space-${s})` }" />
          <span class="swatch__name">space-{{ s }}</span>
        </div>
      </div>

      <p class="guide__label">圆角</p>
      <div class="radii">
        <div v-for="r in RADII" :key="r" class="radius">
          <div class="radius__box" :style="{ borderRadius: `var(--mf-radius-${r})` }" />
          <span class="swatch__name">radius-{{ r }}</span>
        </div>
      </div>

      <p class="guide__label">字号</p>
      <div class="fonts">
        <div v-for="f in FONTS" :key="f" class="font">
          <span :style="{ fontSize: `var(--mf-font-${f})` }">MindForge 求职助手</span>
          <span class="swatch__name">font-{{ f }}</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.guide {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-4);
}

.guide__h2 {
  margin: 0 0 var(--mf-space-1);
  font-size: var(--mf-font-lg);
  font-weight: var(--mf-weight-medium);
}

.guide__h3 {
  margin: 0 0 var(--mf-space-3);
  font-size: var(--mf-font-md);
  font-weight: var(--mf-weight-medium);
}

.guide__hint {
  margin: 0 0 var(--mf-space-4);
  font-size: var(--mf-font-sm);
  line-height: var(--mf-leading);
  color: var(--mf-text-secondary);
}

.guide__label {
  margin: var(--mf-space-4) 0 var(--mf-space-2);
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}

.themes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--mf-space-4);
}

/* ★ 关键：这个容器带 data-theme，里面所有用到 token 的东西自动换肤 ——
   包括 Element Plus 的组件（因为 EP 的变量也被映射到了我们的 token 上）。 */
.theme {
  padding: var(--mf-space-4);
  background-color: var(--mf-bg-page);
  border: 1px solid var(--mf-border);
  border-radius: var(--mf-radius-lg);
  color: var(--mf-text-primary);
}

.swatches,
.tags,
.samples,
.spaces,
.radii,
.fonts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-3);
  align-items: center;
}

.swatch {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-1);
  width: 72px;
}

.swatch__chip {
  height: 28px;
  border: 1px solid var(--mf-border);
  border-radius: var(--mf-radius-sm);
}

.swatch__name {
  font-size: 11px;
  color: var(--mf-text-tertiary);
  word-break: break-all;
}

.samples__input {
  width: 160px;
}

.space,
.radius,
.font {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-1);
}

.space__bar {
  height: 20px;
  background-color: var(--mf-primary);
  border-radius: var(--mf-radius-sm);
}

.radius__box {
  width: 48px;
  height: 48px;
  background-color: var(--mf-primary-subtle);
  border: 1px solid var(--mf-primary);
}

.font {
  align-items: flex-start;
}
</style>
