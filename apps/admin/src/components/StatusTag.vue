<script setup lang="ts">
/**
 * 状态标签 —— 全站统一的状态色。
 *
 * <b>为什么要封一个，而不是各处直接写 el-tag</b>：
 * 同一个「禁用」状态，如果在用户页是红色、在文档页是灰色，
 * 用户每次都得重新判断颜色什么意思。颜色语义收在一处，改也只改这里。
 *
 * 用法：`<StatusTag tone="success">启用</StatusTag>`
 */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

withDefaults(defineProps<{ tone?: StatusTone }>(), { tone: 'neutral' })
</script>

<template>
  <span class="status-tag" :class="`status-tag--${tone}`">
    <slot />
  </span>
</template>

<style scoped>
.status-tag {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 var(--mf-space-2);
  font-size: var(--mf-font-xs);
  line-height: 1;
  white-space: nowrap;
  border-radius: var(--mf-radius-pill);
}

.status-tag--success {
  color: var(--mf-success-text);
  background-color: var(--mf-success-subtle);
}

.status-tag--warning {
  color: var(--mf-warning-text);
  background-color: var(--mf-warning-subtle);
}

.status-tag--danger {
  color: var(--mf-danger-text);
  background-color: var(--mf-danger-subtle);
}

.status-tag--info {
  color: var(--mf-info-text);
  background-color: var(--mf-info-subtle);
}

.status-tag--neutral {
  color: var(--mf-text-secondary);
  background-color: var(--mf-bg-subtle);
}
</style>
