<script setup lang="ts">
import type { InterviewAnalysis } from '@mindforge/shared'

/**
 * 单题的 AI 点评。
 *
 * 抽成组件是因为它要渲染两处：作答时的「本题点评」和报告页的「逐题回顾」。
 * 复制一份的话字段一改就得改两处。
 */
defineProps<{
  analysis: InterviewAnalysis | null
}>()
</script>

<template>
  <div v-if="!analysis" class="empty">（没有点评）</div>

  <div v-else class="a">
    <p v-if="analysis.comment" class="a__comment">{{ analysis.comment }}</p>

    <!-- 答漏的点 —— 逐题反馈里最有用的部分，放前面 -->
    <template v-if="analysis.missingPoints.length">
      <h4 class="a__label">答漏的点</h4>
      <ul class="points points--warn">
        <li v-for="(p, i) in analysis.missingPoints" :key="i">{{ p }}</li>
      </ul>
    </template>

    <template v-if="analysis.technical?.strengths.length">
      <h4 class="a__label">技术上的亮点</h4>
      <ul class="points points--ok">
        <li v-for="(s, i) in analysis.technical.strengths" :key="i">{{ s }}</li>
      </ul>
    </template>

    <template v-if="analysis.technical?.weaknesses.length">
      <h4 class="a__label">技术上的不足</h4>
      <ul class="points points--warn">
        <li v-for="(s, i) in analysis.technical.weaknesses" :key="i">{{ s }}</li>
      </ul>
    </template>

    <template v-if="analysis.communication?.issues.length">
      <h4 class="a__label">表达上的问题</h4>
      <ul class="points points--warn">
        <li v-for="(s, i) in analysis.communication.issues" :key="i">{{ s }}</li>
      </ul>
    </template>

    <p v-if="analysis.followUp" class="a__follow"><strong>追问：</strong>{{ analysis.followUp }}</p>
  </div>
</template>

<style scoped>
.empty {
  margin: 0;
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
}

.a {
  display: flex;
  flex-direction: column;
}

.a__comment {
  margin: 0 0 var(--mf-space-2);
  font-size: var(--mf-font-sm);
  line-height: 1.7;
  color: var(--mf-text-secondary);
  white-space: pre-wrap;
}

.a__label {
  margin: var(--mf-space-3) 0 var(--mf-space-1);
  font-size: var(--mf-font-xs);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-secondary);
}

.points {
  margin: 0;
  padding-left: 1.2em;
  font-size: var(--mf-font-sm);
  line-height: 1.8;
  color: var(--mf-text-secondary);
}

/* 用列表标记的颜色区分「亮点」和「不足」—— 比再加一行小标题省空间 */
.points--ok li::marker {
  color: var(--mf-success);
}

.points--warn li::marker {
  color: var(--mf-warning);
}

.a__follow {
  margin: var(--mf-space-3) 0 0;
  padding: var(--mf-space-3);
  font-size: var(--mf-font-sm);
  line-height: 1.7;
  color: var(--mf-text-secondary);
  background-color: var(--mf-bg-subtle);
  border-left: 3px solid var(--mf-primary);
  border-radius: var(--mf-radius-sm);
}
</style>
