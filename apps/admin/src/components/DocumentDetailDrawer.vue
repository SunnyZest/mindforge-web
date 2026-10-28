<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { AdminDocumentVO } from '@mindforge/shared'
import { BizError } from '@mindforge/shared'
import { Close, Download } from '@element-plus/icons-vue'

import { documentApi } from '@/api/document'
import StatusTag from '@/components/StatusTag.vue'
import { STAGES, STAGE_TEXT, STAGE_TONE, STATUS_TEXT, STATUS_TONE } from '@/utils/document-status'
import { formatBytes, formatDateTime } from '@/utils/format'

const visible = defineModel<boolean>({ required: true })

const props = defineProps<{
  /** 列表里那一行 —— 详情回来之前先用它撑住基础字段 */
  doc: AdminDocumentVO | null
}>()

/**
 * 文档详情。
 *
 * ⚠️ 有 3 个字段**只有详情接口才有**（列表里是 null）：分块数、预签名下载地址、
 *    处理耗时。后端刻意不放列表 —— 列表一页 20 条，每条 count 一次
 *    `document_chunk` 就是 20 次额外查询（N+1），而列表页并不需要这三个数字。
 */
const detail = ref<AdminDocumentVO | null>(null)
const loading = ref(false)

/** 基础字段：详情优先，没到就用列表行兜住 */
const info = computed(() => detail.value ?? props.doc)

const statusText = computed(() => {
  const s = info.value?.status ?? ''
  return STATUS_TEXT[s] ?? s ?? '-'
})

const statusTone = computed(() => STATUS_TONE[info.value?.status ?? ''] ?? 'neutral')

/** 分块数 / 处理耗时 / 下载地址 —— 详情独有，单独判断「是不是真拿到了」 */
const extras = computed(() => {
  const d = detail.value
  if (!d) return null
  return {
    chunkCount: d.chunkCount,
    processDurationMs: d.processDurationMs,
    downloadUrl: d.downloadUrl,
  }
})

/** 毫秒 → 人话。null 表示「还没处理完」或「时钟异常」，不是 0 毫秒 */
function formatDuration(ms: number | null): string {
  if (ms === null || ms < 0) return '-'
  if (ms < 1000) return `${ms} 毫秒`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)} 秒`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} 分 ${Math.round(seconds % 60)} 秒`
}

/**
 * 下载原文件。
 *
 * ⚠️ `downloadUrl` 是**预签名地址，1 小时有效** —— 所以不能缓存下来复用，
 *    每次点都拿这次详情返回的那个。过期后重新打开详情即可。
 */
function download(): void {
  const url = extras.value?.downloadUrl
  if (!url) return
  window.open(url, '_blank', 'noopener')
}

function fail(e: unknown, fallback: string): void {
  ElMessage.error(e instanceof BizError ? e.message : fallback)
}

/** 同时盯 documentId：抽屉开着换一条记录也要重新拉 */
watch(
  () => [visible.value, props.doc?.documentId] as const,
  async ([open]) => {
    if (!open || !props.doc) return

    loading.value = true
    detail.value = null
    try {
      detail.value = await documentApi.detail(props.doc.documentId)
    } catch (e) {
      fail(e, '加载文档详情失败')
    } finally {
      loading.value = false
    }
  },
)
</script>

<template>
  <!-- ⚠️ append-to-body：抽屉写在 <el-card> 里，卡片有 backdrop-filter + overflow:hidden -->
  <el-drawer v-model="visible" size="560px" :with-header="false" append-to-body>
    <div v-loading="loading" class="detail">
      <header class="head">
        <div class="head__main">
          <div class="head__line">
            <span class="head__name" :title="info?.fileName">{{ info?.fileName || '-' }}</span>
            <StatusTag :tone="statusTone">{{ statusText }}</StatusTag>
          </div>
          <span class="head__sub">
            {{ info?.knowledgeBaseName || '未关联知识库' }}
            <template v-if="info?.fileType"> · {{ info.fileType }}</template>
          </span>
        </div>
        <el-button class="head__close" link :icon="Close" title="关闭" @click="visible = false" />
      </header>

      <!-- 基本信息 -->
      <section class="block">
        <h4 class="block__title">基本信息</h4>
        <dl class="fields">
          <div class="fields__row">
            <dt>上传者</dt>
            <dd>{{ info?.username || '-' }}</dd>
          </div>
          <div class="fields__row">
            <dt>文件大小</dt>
            <dd>{{ formatBytes(info?.fileSize) }}</dd>
          </div>
          <div class="fields__row">
            <dt>页数</dt>
            <dd>{{ info?.pageCount ?? '-' }}</dd>
          </div>
          <div class="fields__row">
            <dt>上传时间</dt>
            <dd>{{ formatDateTime(info?.createdAt) }}</dd>
          </div>
          <div class="fields__row">
            <dt>更新时间</dt>
            <dd>{{ formatDateTime(info?.updatedAt) }}</dd>
          </div>
        </dl>
      </section>

      <!-- 处理状态 -->
      <section class="block">
        <h4 class="block__title">
          处理状态
          <span class="block__count">三段各自推进，失败互不影响</span>
        </h4>
        <div class="tags">
          <!-- title 里放原始值：排查时要把后端字段值报给后端，光看中文对不上 -->
          <StatusTag
            v-for="stage in STAGES"
            :key="stage.key"
            :tone="STAGE_TONE[info?.[stage.key] ?? ''] ?? 'neutral'"
            :title="`${stage.label}：${info?.[stage.key] ?? 'null'}`"
          >
            {{ stage.label }} {{ STAGE_TEXT[info?.[stage.key] ?? ''] ?? '—' }}
          </StatusTag>
        </div>
        <p v-if="info?.errorMessage" class="error">{{ info.errorMessage }}</p>
      </section>

      <!-- 详情独有 -->
      <section v-if="extras" class="block">
        <h4 class="block__title">
          处理结果
          <span class="block__count">仅详情接口返回</span>
        </h4>
        <dl class="fields">
          <div class="fields__row">
            <dt>分块数</dt>
            <dd>{{ extras.chunkCount ?? '-' }}</dd>
          </div>
          <div class="fields__row">
            <dt>处理耗时</dt>
            <dd>
              {{ formatDuration(extras.processDurationMs) }}
              <span v-if="extras.processDurationMs !== null" class="fields__note">
                （含排队时间，仅已完成时有值）
              </span>
            </dd>
          </div>
        </dl>
      </section>
    </div>

    <template #footer>
      <div class="foot">
        <span v-if="extras && !extras.downloadUrl" class="foot__hint">
          网页导入的文档没有原文件
        </span>
        <el-button v-if="extras?.downloadUrl" type="primary" :icon="Download" @click="download">
          下载原文件
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-6);
  min-height: 200px;
}

/* ---------- 头部 ---------- */
.head {
  display: flex;
  gap: var(--mf-space-4);
  align-items: flex-start;
}

.head__main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.head__line {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
  min-width: 0;
}

.head__name {
  overflow: hidden;
  font-size: var(--mf-font-lg);
  font-weight: var(--mf-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.head__sub {
  font-size: var(--mf-font-sm);
  color: var(--mf-text-tertiary);
}

.head__close {
  margin-left: auto;
  color: var(--mf-text-tertiary);
}

/* ---------- 区块 ---------- */
.block {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-3);
}

.block__title {
  display: flex;
  gap: var(--mf-space-2);
  align-items: baseline;
  margin: 0;
  font-size: var(--mf-font-sm);
  font-weight: var(--mf-weight-medium);
  color: var(--mf-text-secondary);
}

.block__count {
  font-size: var(--mf-font-xs);
  font-weight: 400;
  color: var(--mf-text-tertiary);
}

/* ---------- 字段 ---------- */
.fields {
  display: flex;
  flex-direction: column;
  gap: var(--mf-space-2);
  margin: 0;
}

.fields__row {
  display: flex;
  gap: var(--mf-space-4);
  font-size: var(--mf-font-sm);
}

.fields__row dt {
  flex: none;
  width: 72px;
  color: var(--mf-text-tertiary);
}

.fields__row dd {
  margin: 0;
  color: var(--mf-text-primary);
  word-break: break-all;
}

.fields__note {
  color: var(--mf-text-tertiary);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mf-space-1);
}

.error {
  margin: 0;
  padding: var(--mf-space-2) var(--mf-space-3);
  font-size: var(--mf-font-xs);
  line-height: 1.6;
  color: var(--mf-danger-text);
  background-color: var(--mf-danger-subtle);
  border-radius: var(--mf-radius-sm);
}

/* ---------- 底部 ---------- */
.foot {
  display: flex;
  gap: var(--mf-space-2);
  align-items: center;
  justify-content: flex-end;
}

.foot__hint {
  font-size: var(--mf-font-xs);
  color: var(--mf-text-tertiary);
}
</style>
